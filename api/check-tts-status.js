import { initializeApp } from 'firebase/app';
import { getFirestore, doc, getDoc, deleteDoc, collection, query, where, getDocs } from 'firebase/firestore';

// Initialize Firebase using environment variables
let app, db;

try {
  const firebaseConfig = {
    apiKey: process.env.FIREBASE_API_KEY,
    authDomain: process.env.FIREBASE_AUTH_DOMAIN,
    projectId: process.env.FIREBASE_PROJECT_ID,
    storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.FIREBASE_APP_ID
  };

  // Check if all required Firebase config is present
  if (!firebaseConfig.apiKey || !firebaseConfig.projectId) {
    console.error('[check-tts-status] Missing Firebase environment variables');
    // Don't throw - just set db to null
    db = null;
  } else {
    app = initializeApp(firebaseConfig);
    db = getFirestore(app);
    console.log('[check-tts-status] Firebase initialized successfully');
  }
} catch (error) {
  console.error('[check-tts-status] Firebase initialization failed:', error.message);
  // Don't throw here - just set db to null
  db = null;
}

export default async function handler(req, res) {
  // CORS headers - match working endpoints exactly
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    res.status(200).end();
    return;
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { jobId } = req.query;

  if (!jobId) {
    return res.status(400).json({ error: 'Missing "jobId" query parameter' });
  }

  // Check if Firebase is available
  if (!db) {
    console.error('[check-tts-status] Firebase not initialized');
    return res.status(500).json({ error: 'Database not available' });
  }

  console.log(`[check-tts-status] Looking for jobId: ${jobId}`);

  try {
    // Get job from Firestore
    const jobRef = doc(db, 'tts_jobs', jobId);
    const jobDoc = await getDoc(jobRef);

    if (!jobDoc.exists()) {
      console.log(`[check-tts-status] Job not found: ${jobId}`);
      return res.status(404).json({ error: 'Job not found' });
    }

    const job = jobDoc.data();
    console.log(`[check-tts-status] Job found: ${jobId}, status: ${job.status}`);

    // Clean up completed/failed jobs older than 1 hour
    const oneHourAgo = new Date(Date.now() - (60 * 60 * 1000));
    const jobsRef = collection(db, 'tts_jobs');
    const cleanupQuery = query(
      jobsRef,
      where('status', 'in', ['completed', 'failed']),
      where('completed_at', '<', oneHourAgo.toISOString())
    );
    
    const cleanupDocs = await getDocs(cleanupQuery);
    cleanupDocs.forEach(async (doc) => {
      await deleteDoc(doc.ref);
      console.log(`[check-tts-status] Cleaned up old job: ${doc.id}`);
    });

    // Return job status
    const response = {
      jobId: job.id,
      status: job.status,
      created_at: job.created_at,
      tts_provider: job.tts_provider,
      voice_id: job.voice_id
    };

    if (job.status === 'completed') {
      response.audioUrl = job.result;
      response.completed_at = job.completed_at;
    } else if (job.status === 'failed') {
      response.error = job.error;
      response.completed_at = job.completed_at;
    }

    return res.status(200).json(response);
  } catch (error) {
    console.error(`[check-tts-status] Error: ${error.message}`);
    return res.status(500).json({ error: 'Failed to check job status' });
  }
} 