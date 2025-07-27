import { initializeApp } from 'firebase/app';
import { getFirestore, doc, getDoc, deleteDoc, collection, query, where, getDocs } from 'firebase/firestore';

// Initialize Firebase (same config as generate-audio-async)
const firebaseConfig = {
  apiKey: "AIzaSyBrakU4encBm0p3swJutJWefenCZu47qX8",
  authDomain: "storyseed-28eec.firebaseapp.com",
  projectId: "storyseed-28eec",
  storageBucket: "storyseed-28eec.firebasestorage.app",
  messagingSenderId: "602423243941",
  appId: "1:602423243941:web:56850b384826b5de4f894c"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

export default async function handler(req, res) {
  // CORS headers
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { jobId } = req.query;

  if (!jobId) {
    return res.status(400).json({ error: 'Missing "jobId" query parameter' });
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