import { FirebaseConfig, ProjectFile, PwaProject } from '../types/ide';

export async function saveProjectToFirestore(
  config: FirebaseConfig,
  project: PwaProject
): Promise<{ documentUrl: string; savedAt: string }> {
  if (!config.projectId.trim()) {
    throw new Error('Inserisci il Project ID di Firebase prima di sincronizzare.');
  }

  const docId = project.id.replace(/[^a-zA-Z0-9_-]/g, '_');
  const keyParam = config.apiKey.trim()
    ? `?key=${encodeURIComponent(config.apiKey.trim())}`
    : '';
  const url = `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(
    config.projectId.trim()
  )}/databases/(default)/documents/codefid_projects/${docId}${keyParam}`;

  const body = {
    fields: {
      id: { stringValue: project.id },
      name: { stringValue: project.name },
      description: { stringValue: project.description },
      updatedAt: { stringValue: new Date().toISOString() },
      filesJson: { stringValue: JSON.stringify(project.files) },
      manifestJson: { stringValue: JSON.stringify(project.manifestConfig) }
    }
  };

  const res = await fetch(url, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(
      `Errore Firestore (${res.status}): verifica che il database Firestore sia attivo e le regole consentano la scrittura. Dettagli: ${errText.slice(0, 140)}`
    );
  }

  return {
    documentUrl: `https://console.firebase.google.com/project/${config.projectId.trim()}/firestore/data/~2Fcodefid_projects~2F${docId}`,
    savedAt: new Date().toLocaleTimeString()
  };
}

export async function loadProjectFromFirestore(
  config: FirebaseConfig,
  projectIdSlug: string
): Promise<{ files: ProjectFile[]; name?: string } | null> {
  if (!config.projectId.trim()) {
    throw new Error('Inserisci il Project ID di Firebase.');
  }
  const docId = projectIdSlug.replace(/[^a-zA-Z0-9_-]/g, '_');
  const keyParam = config.apiKey.trim()
    ? `?key=${encodeURIComponent(config.apiKey.trim())}`
    : '';
  const url = `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(
    config.projectId.trim()
  )}/databases/(default)/documents/codefid_projects/${docId}${keyParam}`;

  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Documento Firestore non trovato (${res.status}).`);
  }
  const data = await res.json();
  const filesJson = data?.fields?.filesJson?.stringValue;
  if (!filesJson) return null;

  return {
    files: JSON.parse(filesJson),
    name: data?.fields?.name?.stringValue
  };
}

export function injectFirebaseHostingFiles(
  files: ProjectFile[],
  config: FirebaseConfig
): ProjectFile[] {
  const next = files.map((f) => ({ ...f }));
  const projectId = config.projectId.trim() || 'my-codefid-pwa';

  const upsert = (path: string, content: string, language: ProjectFile['language']) => {
    const idx = next.findIndex((f) => f.path === path);
    if (idx >= 0) {
      next[idx] = { ...next[idx], content, modified: true };
    } else {
      next.push({ path, content, language, modified: true });
    }
  };

  upsert(
    'firebase.json',
    JSON.stringify(
      {
        hosting: {
          public: '.',
          ignore: ['firebase.json', '**/.*', '**/node_modules/**'],
          rewrites: [{ source: '**', destination: '/index.html' }],
          headers: [
            {
              source: '/sw.js',
              headers: [{ key: 'Cache-Control', value: 'no-cache' }]
            }
          ]
        }
      },
      null,
      2
    ),
    'json'
  );

  upsert(
    '.firebaserc',
    JSON.stringify(
      {
        projects: {
          default: projectId
        }
      },
      null,
      2
    ),
    'json'
  );

  upsert(
    'firebaseConfig.js',
    `// Configurazione Firebase generata da CodeFID Tablet IDE
export const firebaseConfig = {
  apiKey: "${config.apiKey || 'AIzaSy_INSERISCI_API_KEY'}",
  authDomain: "${config.authDomain || `${projectId}.firebaseapp.com`}",
  projectId: "${projectId}",
  storageBucket: "${config.storageBucket || `${projectId}.appspot.com`}",
  appId: "${config.appId || '1:00000000:web:codefidpwa'}"
};
`,
    'javascript'
  );

  return next;
}
