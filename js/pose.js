// ═══════════════════════════════════════════════════════════════
// 👁️ RECONHECIMENTO CORPORAL — MediaPipe Tasks Vision (BlazePose)
//
// Este módulo é a ÚNICA parte do projeto que sabe qual biblioteca de visão
// computacional está sendo usada. Todo o resto do jogo conversa com ele por
// uma leitura genérica: pontos em pixels para desenhar, pontos em METROS
// para medir. Trocar de biblioteca amanhã é reescrever só este arquivo.
//
// POR QUE BLAZEPOSE E NÃO O MOVENET QUE ESTAVA AQUI ANTES
// O MoveNet devolve 17 pontos em 2D. Para flexão de perfil isso basta: o
// movimento acontece no plano da imagem. Para a flexão DE FRENTE não basta —
// o braço se move quase na direção da lente, e em 2D essa direção é
// justamente a que some. Era essa a raiz da instabilidade: não havia número
// confiável para extrair, por mais que o algoritmo fosse refinado.
//
// O BlazePose devolve 33 pontos e, além deles, `worldLandmarks`: coordenadas
// em METROS, com origem no meio do quadril. Com elas o ângulo do cotovelo é
// um ângulo de verdade, calculado em três dimensões — imune à perspectiva,
// à distância da câmera e ao tamanho da pessoa.
// ═══════════════════════════════════════════════════════════════

export const POSE_CDN = {
  bundle: 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.0.1/vision_bundle.mjs',
  wasm:   'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.0.1/wasm',
  // "lite" de propósito: 5,8 MB contra 9,8 MB do "full", com precisão de sobra
  // para contar flexão. O peso é baixado uma vez e fica no cache do navegador.
  modelo: 'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task',
};

// Os 17 nomes que o resto do jogo já usava (herdados do MoveNet), traduzidos
// para os índices do BlazePose. Manter o vocabulário evitou tocar no desenho
// do esqueleto, no enquadramento e nas regras de cada exercício.
export const PONTOS = {
  nose:0, left_eye:2, right_eye:5, left_ear:7, right_ear:8,
  left_shoulder:11, right_shoulder:12, left_elbow:13, right_elbow:14,
  left_wrist:15, right_wrist:16, left_hip:23, right_hip:24,
  left_knee:25, right_knee:26, left_ankle:27, right_ankle:28,
};
const NOMES = Object.keys(PONTOS);

export class PoseError extends Error{
  constructor(msg){ super(msg); this.kind = 'model'; }
}

let landmarker = null;
let carregando = null;
let ultimoTs = -1;

export const Pose = {
  pronto(){ return !!landmarker; },

  // Baixa o WASM e o modelo sob demanda — nunca na abertura do jogo.
  // Chamar duas vezes em paralelo devolve a MESMA promessa: dois toques
  // seguidos no botão não disparam dois downloads.
  carregar(){
    if(landmarker) return Promise.resolve();
    if(carregando)  return carregando;
    carregando = (async ()=>{
      let V;
      try{
        V = await import(/* @vite-ignore */ POSE_CDN.bundle);
      }catch(e){
        throw new PoseError('Não foi possível baixar o reconhecimento corporal. Verifique sua conexão e tente de novo.');
      }
      const fileset = await V.FilesetResolver.forVisionTasks(POSE_CDN.wasm);
      const opcoes = delegate => ({
        baseOptions:{ modelAssetPath: POSE_CDN.modelo, delegate },
        runningMode:'VIDEO',
        numPoses:1,
        // limiares baixos de propósito: quem decide se o corpo está bom o
        // bastante é o enquadramento do jogo, com números que o jogador vê.
        minPoseDetectionConfidence:0.4,
        minPosePresenceConfidence:0.4,
        minTrackingConfidence:0.4,
      });
      try{
        landmarker = await V.PoseLandmarker.createFromOptions(fileset, opcoes('GPU'));
      }catch(e){
        // aparelho sem WebGL utilizável — o delegate de CPU roda em qualquer um
        landmarker = await V.PoseLandmarker.createFromOptions(fileset, opcoes('CPU'));
      }
      ultimoTs = -1;
    })().catch(err=>{ carregando = null; throw err; });
    return carregando;
  },

  // Uma leitura do vídeo. Devolve null quando não há ninguém no quadro.
  //   keypoints → pixels do vídeo, para desenhar e para o enquadramento
  //   mundo     → metros, para os ângulos das articulações
  detectar(video, tsMs){
    if(!landmarker || !video.videoWidth) return null;
    // detectForVideo exige carimbo de tempo sempre crescente
    const ts = (tsMs > ultimoTs) ? tsMs : ultimoTs + 1;
    ultimoTs = ts;

    const r = landmarker.detectForVideo(video, ts);
    if(!r || !r.landmarks || !r.landmarks.length) return null;

    const norm = r.landmarks[0];
    const mundo3d = (r.worldLandmarks && r.worldLandmarks[0]) || null;
    const w = video.videoWidth, h = video.videoHeight;

    const keypoints = NOMES.map(nome=>{
      const p = norm[PONTOS[nome]];
      return { name:nome, x:p.x * w, y:p.y * h,
               // "visibility" do BlazePose ocupa o lugar do "score" do MoveNet
               score:(p.visibility !== undefined ? p.visibility : 1) };
    });

    const mundo = {};
    if(mundo3d) NOMES.forEach(nome=>{
      const p = mundo3d[PONTOS[nome]];
      mundo[nome] = { x:p.x, y:p.y, z:p.z,
                      score:(p.visibility !== undefined ? p.visibility : 1) };
    });

    return { keypoints, mundo, __vw:w, __vh:h };
  },

  liberar(){
    if(landmarker){ try{ landmarker.close(); }catch(e){} }
    landmarker = null; carregando = null; ultimoTs = -1;
  }
};

// ---------------------------------------------------------------
// Geometria — a parte que o 3D torna simples.
// ---------------------------------------------------------------
export function kp(pose, name){ return pose.keypoints.find(k => k.name === name); }

// Ângulo em B, no espaço. É o mesmo cálculo do 2D com uma coordenada a mais,
// e é essa coordenada que faz a flexão frontal existir como medida.
export function angulo3D(a, b, c){
  const ab = { x:a.x-b.x, y:a.y-b.y, z:a.z-b.z };
  const cb = { x:c.x-b.x, y:c.y-b.y, z:c.z-b.z };
  const dot = ab.x*cb.x + ab.y*cb.y + ab.z*cb.z;
  const mA = Math.hypot(ab.x, ab.y, ab.z), mC = Math.hypot(cb.x, cb.y, cb.z);
  if(mA === 0 || mC === 0) return 180;
  return Math.acos(Math.max(-1, Math.min(1, dot/(mA*mC)))) * (180/Math.PI);
}

// Média dos dois lados do corpo, ignorando o lado que a câmera não vê bem.
// Um lado só já sustenta a leitura — é o que salva quando o corpo gira.
export function articulacao(pose, esquerda, direita, minVisivel){
  if(!pose.mundo || !pose.mundo[esquerda[0]]) return null;
  const angulos = [], notas = [];
  [esquerda, direita].forEach(nomes=>{
    const pts = nomes.map(n => pose.mundo[n]);
    if(pts.every(p => p && p.score > minVisivel)){
      angulos.push(angulo3D(pts[0], pts[1], pts[2]));
      pts.forEach(p => notas.push(p.score));
    }
  });
  if(!angulos.length) return null;
  return {
    value: angulos.reduce((a,b)=>a+b, 0) / angulos.length,
    confidence: notas.reduce((a,b)=>a+b, 0) / notas.length,
  };
}
