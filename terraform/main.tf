###############################################
# main.tf  —  Diagnovera infra (GCP)
###############################################

terraform {
  required_version = ">= 1.5.0"
  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "~> 5.0"
    }
  }
  # Backend is expected in backend.tf (GCS)
}

###############################################
# Variables (override via terraform.tfvars)
###############################################
variable "project_id" {
  description = "GCP project ID"
  type        = string
}

variable "region" {
  description = "GCP region for regional resources"
  type        = string
  default     = "us-central1"
}

variable "repo_id" {
  description = "Artifact Registry repository ID (Docker)"
  type        = string
  default     = "diagnovera"
}

variable "reference_bucket_name" {
  description = "GCS bucket for reference library"
  type        = string
  default     = null
}

# Cloud Run API image (full Artifact Registry URI)
variable "api_image" {
  description = "Container image for the backend API (e.g. us-central1-docker.pkg.dev/PROJECT/diagnovera/diagnovera-api:TAG)"
  type        = string
}

variable "cors_allowlist" {
  description = "Comma-separated origins allowed by the API (no spaces)"
  type        = string
  default     = "http://localhost:5173"
}

variable "app_version" {
  description = "Arbitrary version string to inject into the API"
  type        = string
  default     = "local"
}

# Cloud Run Job (Process A lite)
variable "job_image" {
  description = "Container image for the Process-A job"
  type        = string
}

variable "job_args" {
  description = "Args list for the Process-A job container"
  type        = list(string)
  default     = [] # Example below in locals
}

variable "job_tasks" {
  description = "Total task shards for the job"
  type        = number
  default     = 1
}

variable "job_parallelism" {
  description = "How many tasks run in parallel"
  type        = number
  default     = 1
}

variable "job_timeout_seconds" {
  description = "Per-task timeout seconds"
  type        = number
  default     = 3600
}

###############################################
# Provider
###############################################
provider "google" {
  project = var.project_id
  region  = var.region
}

###############################################
# Locals
###############################################
locals {
  ref_bucket = coalesce(
    var.reference_bucket_name,
    "${var.project_id}-reference"
  )

  # Example job args (override via terraform.tfvars if needed)
  example_job_args = [
    "--project=${var.project_id}",
    "--icd10-xlsx=gs://${local.ref_bucket}/icd10/2026/ICD10_2026.xlsx",
    "--out-gcs=gs://${local.ref_bucket}/literature/raw",
    "--bq-dataset=reference",
    "--bq-table=literature_index",
    "--max-articles=2",
    "--entrez-email=you@example.com",
    # optionally:
    # "--entrez-api-key=YOUR_API_KEY",
    # "--code-col=CODE",
    # "--name-col=LONG DESCRIPTION (VALID ICD-10 FY2022)"
  ]
}

###############################################
# Enable required APIs
###############################################
resource "google_project_service" "apis" {
  for_each = toset([
    "run.googleapis.com",
    "artifactregistry.googleapis.com",
    "cloudbuild.googleapis.com",
    "iam.googleapis.com",
    "serviceusage.googleapis.com",
    "storage.googleapis.com",
    "bigquery.googleapis.com",
    "logging.googleapis.com",
  ])
  service            = each.value
  disable_on_destroy = false
}

###############################################
# Artifact Registry (Docker)
###############################################
resource "google_artifact_registry_repository" "repo" {
  location       = var.region
  repository_id  = var.repo_id
  description    = "Diagnovera containers"
  format         = "DOCKER"

  depends_on = [google_project_service.apis]
}

###############################################
# GCS bucket for reference library
###############################################
resource "google_storage_bucket" "reference" {
  name     = local.ref_bucket
  location = var.region

  uniform_bucket_level_access = true
  public_access_prevention    = "enforced"
  force_destroy               = false

  versioning {
    enabled = true
  }

  lifecycle_rule {
    condition { num_newer_versions = 20 }
    action    { type = "Delete" }
  }

  labels = {
    app = "diagnovera"
  }

  depends_on = [google_project_service.apis]
}

###############################################
# BigQuery dataset
###############################################
resource "google_bigquery_dataset" "reference" {
  dataset_id  = "reference"
  location    = "US"
  description = "Diagnovera reference dataset"

  labels = {
    app = "diagnovera"
  }

  depends_on = [google_project_service.apis]
}

###############################################
# Service Account for Cloud Run (service + job)
###############################################
resource "google_service_account" "runner" {
  account_id   = "diagnovera-runner"
  display_name = "Diagnovera Runner"
}

# Minimal perms: write logs, access GCS objects, write to BQ
resource "google_project_iam_member" "runner_log_writer" {
  role   = "roles/logging.logWriter"
  member = "serviceAccount:${google_service_account.runner.email}"
}

resource "google_project_iam_member" "runner_storage" {
  role   = "roles/storage.objectAdmin"
  member = "serviceAccount:${google_service_account.runner.email}"
}

resource "google_project_iam_member" "runner_bq" {
  role   = "roles/bigquery.dataEditor"
  member = "serviceAccount:${google_service_account.runner.email}"
}

###############################################
# Cloud Run Service — API
###############################################
resource "google_cloud_run_v2_service" "api" {
  name     = "diagnovera-api"
  location = var.region
  ingress  = "INGRESS_TRAFFIC_ALL"

  template {
    service_account = google_service_account.runner.email

    containers {
      image = var.api_image

      env { name = "CORS_ALLOWLIST" value = var.cors_allowlist }
      env { name = "APP_VERSION"    value = var.app_version }
      # Add more envs if your API needs them
      # ports { container_port = 8080 }  # default is 8080
    }

    # Uncomment to keep a few warm instances
    # scaling {
    #   min_instance_count = 0
    #   max_instance_count = 3
    # }
  }

  traffic {
    type    = "TRAFFIC_TARGET_ALLOCATION_TYPE_LATEST"
    percent = 100
  }

  depends_on = [
    google_project_service.apis,
    google_service_account.runner
  ]
}

# Allow public (unauthenticated) access to the API
resource "google_cloud_run_v2_service_iam_member" "api_invoker" {
  name     = google_cloud_run_v2_service.api.name
  location = var.region
  role     = "roles/run.invoker"
  member   = "allUsers"
}

###############################################
# Cloud Run Job — Process A (lite)
###############################################
resource "google_cloud_run_v2_job" "process_a" {
  name     = "process-a-lite"
  location = var.region

  template {
    template {
      service_account = google_service_account.runner.email

      containers {
        image = var.job_image
        # Use provided args if non-empty; else use example defaults
        args  = length(var.job_args) > 0 ? var.job_args : local.example_job_args
        # env { name = "ENTREZ_API_KEY" value = "…" } # prefer passing via args or secrets
      }

      # Timeout per task
      timeout = "${var.job_timeout_seconds}s"
    }

    task_count  = var.job_tasks
    parallelism = var.job_parallelism
  }

  depends_on = [
    google_project_service.apis,
    google_service_account.runner
  ]
}

###############################################
# Outputs
###############################################
output "artifact_repo" {
  value       = google_artifact_registry_repository.repo.id
  description = "Artifact Registry repository ID"
}

output "reference_bucket" {
  value       = google_storage_bucket.reference.name
  description = "Reference GCS bucket"
}

output "bigquery_dataset" {
  value       = google_bigquery_dataset.reference.dataset_id
  description = "BigQuery dataset ID"
}

output "api_url" {
  value       = google_cloud_run_v2_service.api.uri
  description = "Cloud Run API base URL"
}

output "job_name" {
  value       = google_cloud_run_v2_job.process_a.name
  description = "Cloud Run Job name"
}


# Firestore Database
resource "google_firestore_database" "diagnostic_db" {
  project     = var.project_id
  name        = "(default)"
  location_id = var.region
  type        = "FIRESTORE_NATIVE"
}

# Cloud Storage Bucket
resource "google_storage_bucket" "diagnostic_data" {
  name          = "${var.project_id}-diagnostic-data"
  location      = var.region
  force_destroy = false

  versioning {
    enabled = true
  }

  lifecycle_rule {
    condition {
      age = 90
    }
    action {
      type = "Delete"
    }
  }
}

# Pub/Sub Topics
resource "google_pubsub_topic" "diagnostic_processing" {
  name = "diagnostic-processing"
}

resource "google_pubsub_topic" "library_building" {
  name = "library-building"
}

# Cloud Functions
resource "google_cloudfunctions_function" "patient_processor" {
  name        = "process-patient-encounter"
  description = "Process patient encounters with NLP"
  runtime     = "python39"
  
  available_memory_mb   = 512
  source_archive_bucket = google_storage_bucket.function_bucket.name
  source_archive_object = google_storage_bucket_object.patient_processor_zip.name
  
  event_trigger {
    event_type = "google.pubsub.topic.publish"
    resource   = google_pubsub_topic.diagnostic_processing.name
  }
  
  entry_point = "process_encounter"
  timeout     = 300
}

resource "google_cloudfunctions_function" "library_builder" {
  name        = "build-reference-library"
  description = "Build ICD10 reference library"
  runtime     = "python39"
  
  available_memory_mb   = 2048
  source_archive_bucket = google_storage_bucket.function_bucket.name
  source_archive_object = google_storage_bucket_object.library_builder_zip.name
  
  event_trigger {
    event_type = "google.pubsub.topic.publish"
    resource   = google_pubsub_topic.library_building.name
  }
  
  entry_point = "build_library"
  timeout     = 540
}