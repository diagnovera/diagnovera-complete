import os
os.environ['GOOGLE_APPLICATION_CREDENTIALS'] = 'diagnovera-sa-key.json'
os.environ['GCP_PROJECT_ID'] = 'genial-core-467800-k8'

print("Testing DIAGNOVERA connection...")
print(f"Project: genial-core-467800-k8")
print(f"Credentials: {os.environ['GOOGLE_APPLICATION_CREDENTIALS']}")

try:
    from google.cloud import firestore
    db = firestore.Client(project='genial-core-467800-k8')
    
    # Test write
    test_ref = db.collection('_test').document('connection_test')
    test_ref.set({'status': 'connected', 'project': 'genial-core-467800-k8'})
    
    # Test read
    doc = test_ref.get()
    if doc.exists:
        print("✓ Successfully connected to Firestore!")
        print(f"✓ Test document: {doc.to_dict()}")
        
        # Cleanup
        test_ref.delete()
        print("✓ Cleanup completed")
    else:
        print("✗ Could not read test document")
        
except Exception as e:
    print(f"✗ Connection failed: {e}")
    print("\nTroubleshooting:")
    print("1. Check if billing is enabled: https://console.cloud.google.com/billing?project=genial-core-467800-k8")
    print("2. Check if Firestore API is enabled: https://console.cloud.google.com/apis/library/firestore.googleapis.com?project=genial-core-467800-k8")
    print("3. Check IAM permissions: https://console.cloud.google.com/iam-admin/iam?project=genial-core-467800-k8")
