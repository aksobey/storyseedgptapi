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

  // Get job from memory
  if (!global.ttsJobs) {
    console.log(`[check-tts-status] No global.ttsJobs found for jobId: ${jobId}`);
    return res.status(404).json({ error: 'Job not found' });
  }

  console.log(`[check-tts-status] Looking for jobId: ${jobId}, total jobs: ${global.ttsJobs.size}`);
  const job = global.ttsJobs.get(jobId);

  if (!job) {
    console.log(`[check-tts-status] Job not found: ${jobId}`);
    return res.status(404).json({ error: 'Job not found' });
  }

  console.log(`[check-tts-status] Job found: ${jobId}, status: ${job.status}`);

  // Clean up completed/failed jobs older than 1 hour
  const oneHourAgo = Date.now() - (60 * 60 * 1000);
  for (const [id, jobData] of global.ttsJobs.entries()) {
    if (jobData.completed_at && new Date(jobData.completed_at).getTime() < oneHourAgo) {
      global.ttsJobs.delete(id);
    }
  }

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
} 