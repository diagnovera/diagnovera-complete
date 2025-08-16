import sys
print(f"Python version: {sys.version}")

try:
    import google.cloud
    print("✓ google.cloud package found")
except ImportError:
    print("✗ google.cloud not installed")
    print("Run: python -m pip install google-cloud-firestore")

try:
    from google.cloud import firestore
    print("✓ firestore module imported")
except ImportError as e:
    print(f"✗ Cannot import firestore: {e}")