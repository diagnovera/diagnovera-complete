terraform {
  backend "gcs" {
    bucket = "icd10-diagnosis-system-2024-terraform-state"
    prefix = "infra"
  }
}
