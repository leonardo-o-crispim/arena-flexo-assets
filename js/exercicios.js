// ═══════════════════════════════════════════════════════════════
// 🏋️ EXERCÍCIOS E REPETIÇÕES
// O que separa "corpo se mexendo" de "uma repetição válida".
// Não conhece inimigo, dano nem ouro: apenas anuncia EXERCISE_COMPLETED.
// Quem decide o que isso significa é a lógica de batalha, no index.html.
// ═══════════════════════════════════════════════════════════════
import { kp, articulacao } from './pose.js';

// ---------------------------------------------------------------
// 📨 BARRAMENTO DE EVENTOS — a única ponte entre reconhecimento e jogo
// ---------------------------------------------------------------
export const Events = {
  _l:{},
  on(type, fn){ (this._l[type] = this._l[type] || []).push(fn); },
  off(type, fn){ if(this._l[type]) this._l[type] = this._l[type].filter(f=>f!==fn); },
  emit(type, payload){ (this._l[type]||[]).forEach(fn=>{ try{ fn(payload); }catch(e){ console.error(e); } }); }
};
export const EVT = { COMPLETED:'EXERCISE_COMPLETED', STATE:'EXERCISE_STATE', INVALID:'EXERCISE_INVALID' };

// ---------------------------------------------------------------
// Os limiares vivem no PERFIL do jogador, que é do index.html.
// Em vez de importar o perfil aqui (e amarrar os dois arquivos), o index
// injeta uma função. O módulo continua testável sozinho.
// ---------------------------------------------------------------
let obterLimiares = id => ({ ...EXERCISES[id].defaults });
export function usarLimiares(fn){ obterLimiares = fn; }

// ═══════════════════════════════════════════════════════════════
// EXERCÍCIOS — cada exercício é um ATAQUE do RPG.
//   baseDamage → dano base por repetição (a arma SOMA o bônus dela)
//   gold       → ouro por repetição
//   measure()  → devolve um ÂNGULO EM GRAUS, medido em 3D
//
// Todas as medidas agora são ângulos reais de articulação, em graus, obtidos
// das coordenadas em metros do BlazePose. Antes o modo frontal precisava de
// uma fórmula própria — mistura de quatro sinais 2D com pesos — porque de
// frente o ângulo do cotovelo aparecia achatado pela perspectiva. Com 3D esse
// problema deixa de existir: os dois modos de flexão medem A MESMA COISA, e
// aquela fórmula inteira pôde ser apagada.
// ═══════════════════════════════════════════════════════════════
export const EXERCISES = {
  flexao: {
    label:'Flexão', icon:'ex_pushup', repLabel:'flexões',
    baseDamage:2, gold:0.5, tipo:'força',
    defaults:{ down:100, up:150, minScore:0.30 },
    faixaEnergia:{ de:100, ate:150 },
    measure(pose, MIN){ return articulacao(pose, ['left_shoulder','left_elbow','left_wrist'],
                                                 ['right_shoulder','right_elbow','right_wrist'], MIN); }
  },
  // ---- ABDOMINAL (substituiu o agachamento) ----
  // Medido de PERFIL, pelo ângulo do quadril: ombro–quadril–joelho. Deitado o
  // tronco fica aberto em relação à coxa; ao contrair, fecha. É a mesma função
  // `articulacao` dos outros — nenhum detector novo.
  //
  // ⚠️ ATENÇÃO: aqui o movimento é INVERTIDO em relação à flexão. Deitado é o
  // ângulo ALTO (repouso) e contraído é o BAIXO (esforço). A máquina de estados
  // não muda: ela só quer que o valor atravesse a faixa e volte. Quem muda são
  // os rótulos do HUD, por isso `rotulosEstado` existe.
  //
  // Os limiares abaixo são geométricos e AINDA NÃO foram medidos num corpo real
  // — mesma situação em que a flexão frontal começou. Confira o `ângulo` no
  // painel 🔍 e ajuste, ou me mande um vídeo como o da última vez.
  abdominal: {
    label:'Abdominal', icon:'ex_situp', repLabel:'abdominais',
    baseDamage:2, gold:0.5, tipo:'força',
    defaults:{ down:100, up:125, minScore:0.30 },
    faixaEnergia:{ de:100, ate:135 },
    rotulosEstado:{ READY:'SUBA', BOTTOM:'DESÇA' },   // invertido: repouso é deitado
    measure(pose, MIN){ return articulacao(pose, ['left_shoulder','left_hip','left_knee'],
                                                 ['right_shoulder','right_hip','right_knee'], MIN); }
  },
  polichinelo: {
    label:'Polichinelo', icon:'ex_jack', repLabel:'polichinelos',
    // metade do ouro dos exercícios de força, como sempre foi — a proporção
    // se manteve quando o ouro por repetição caiu pela metade
    baseDamage:1, gold:0.25, tipo:'cardio',
    defaults:{ down:45, up:140, minScore:0.30 },
    faixaEnergia:{ de:45, ate:140 },
    measure(pose, MIN){ return articulacao(pose, ['left_hip','left_shoulder','left_wrist'],
                                                 ['right_hip','right_shoulder','right_wrist'], MIN); }
  },
  // ---- FLEXÃO DE FRENTE (oculta da grade: escolhida na preparação) ----
  // Mesma medida da lateral. O que muda é só o ENQUADRAMENTO exigido e o guia
  // de posicionamento — de frente o quadril e os pés não aparecem.
  flexao_frontal: {
    label:'Flexão frontal', icon:'ex_pushup', repLabel:'flexões', oculto:true,
    baseDamage:2, gold:0.5, tipo:'força',
    // ⚙️ CALIBRADO COM MEDIÇÃO REAL (vídeo de 19/08, 8 flexões em 40 s).
    // O `down` era 100° e NUNCA era alcançado: lido no painel de debug, o vale
    // mais fundo do sinal foi 102° e o mais raso 130° — a máquina de estados
    // nunca saía de READY e o placar fechou em 0. Os picos ficaram todos acima
    // de 156°, então o `up` de 150° já estava certo e não foi tocado.
    // Com 140°/150°, a mesma série dá 8 repetições e 0 descartes.
    // A faixa da barra de energia continua 100→150: ela não segue os gatilhos.
    defaults:{ down:140, up:150, minScore:0.30 },
    faixaEnergia:{ de:100, ate:150 },
    measure(pose, MIN){ return articulacao(pose, ['left_shoulder','left_elbow','left_wrist'],
                                                 ['right_shoulder','right_elbow','right_wrist'], MIN); }
  }
};
export const FLEXAO_MODOS = ['flexao','flexao_frontal'];
export const ehFlexao = id => FLEXAO_MODOS.includes(id);

// ---------------------------------------------------------------
// 🧍 FORMA — só o suficiente para impedir o descarado.
// Sem 3D isto era impossível de frente; agora o mesmo teste serve para os
// dois modos. Continua tolerante: sem pontos confiáveis, não penaliza.
// ---------------------------------------------------------------
const FORMA = {
  troncoEsticado: 125,   // flexão: ombro–quadril–joelho quase reto
  joelhoDobrado: 130,    // abdominal: joelho dobrado, pé no chão (evita "canivete")
};
function anguloTronco(pose, MIN){
  return articulacao(pose, ['left_shoulder','left_hip','left_knee'],
                           ['right_shoulder','right_hip','right_knee'], MIN);
}
const VALIDA_FORMA = {
  flexao:         (pose, MIN)=>{ const t = anguloTronco(pose, MIN); return !t || t.value > FORMA.troncoEsticado; },
  flexao_frontal: (pose, MIN)=>{ const t = anguloTronco(pose, MIN); return !t || t.value > FORMA.troncoEsticado; },
  abdominal:      (pose, MIN)=>{
    const j = articulacao(pose, ['left_hip','left_knee','left_ankle'],
                                ['right_hip','right_knee','right_ankle'], MIN);
    return !j || j.value < FORMA.joelhoDobrado;    // perna esticada não é abdominal
  },
  polichinelo:    ()=> true,
};

// ═══════════════════════════════════════════════════════════════
// 🔁 DETECTOR — máquina de DOIS estados, uma só para todos.
//
//     EM CIMA  ──ângulo caiu abaixo de `down`──▶  EMBAIXO
//     EM CIMA  ◀──ângulo subiu acima de `up`────  EMBAIXO   → +1 repetição
//
// Os dois limiares ficam distantes um do outro (histerese): o ângulo precisa
// atravessar a faixa inteira para trocar de estado, então tremer em volta de
// um limiar não gera repetição nenhuma. Fora isso, só a duração mínima do
// ciclo — é ela que separa repetição de solavanco.
//
// Antes existiam duas máquinas: uma de quatro fases para os outros exercícios
// e esta para a flexão frontal. Com ângulos reais em graus, a de quatro fases
// perdeu a razão de existir e saiu junto com o resto do código antigo.
// ═══════════════════════════════════════════════════════════════
export const DETECTOR_RULES = {
  suavizacao: 0.4,    // média móvel: peso do valor novo (menor = mais estável)
  memoriaMs: 1200,    // por quanto tempo o último valor bom sobrevive a um sumiço
  minCicloMs: 500,    // ciclo mais curto que isso é solavanco, não repetição
  cooldownMs: 250,    // respiro entre uma repetição e a próxima
};

export class ExerciseDetector {
  constructor(exerciseId){
    this.id = exerciseId;
    this.def = EXERCISES[exerciseId];
    this.validar = VALIDA_FORMA[exerciseId] || (()=>true);
    this.reset();
  }
  get thresholds(){ return obterLimiares(this.id); }

  reset(){
    this.state = 'READY';    // vocabulário do HUD: READY = em cima ("DESÇA")
    this.reps = 0;
    this.rejections = 0;
    this.suave = null;
    this.lastValue = null; this.lastConfidence = 0;
    this.tUltimoBom = 0; this.tDescida = 0; this.tLastRep = 0;
  }

  update(pose, now){
    const th = this.thresholds, R = DETECTOR_RULES;
    const m = this.def.measure(pose, th.minScore);

    if(m){
      // média móvel: um quadro ruim isolado desloca pouco o valor
      this.suave = (this.suave === null) ? m.value : this.suave + (m.value - this.suave) * R.suavizacao;
      this.lastConfidence = m.confidence;
      this.tUltimoBom = now;
    } else if(this.suave === null || now - this.tUltimoBom > R.memoriaMs){
      this.lastValue = null; return null;        // sumiu de vez: aí sim, sem leitura
    }
    // entre um caso e outro: a leitura sumiu HÁ POUCO e o último valor ainda
    // vale. É o que impede o ciclo de se perder numa piscada do rastreamento.

    const v = this.suave;
    this.lastValue = v;
    const prev = this.state;
    const formaOK = this.validar(pose, th.minScore);

    if(this.state === 'READY'){
      if(v < th.down && formaOK && now - this.tLastRep > R.cooldownMs){
        this.state = 'BOTTOM';                   // vocabulário do HUD: BOTTOM = embaixo ("SUBA")
        this.tDescida = now;
      }
    } else if(v > th.up){
      const dur = now - this.tDescida;
      this.state = 'READY';
      if(dur >= R.minCicloMs && formaOK){
        this.reps++; this.tLastRep = now;
        Events.emit(EVT.COMPLETED, {
          type: EVT.COMPLETED, exercise:this.id, repetition:this.reps,
          confidence: Number((this.lastConfidence || 0).toFixed(2)), durationMs: dur
        });
      } else {
        this.rejections++;
        Events.emit(EVT.INVALID, { reason: dur < R.minCicloMs ? 'movimento rápido demais' : 'forma incorreta' });
      }
    }
    if(prev !== this.state) Events.emit(EVT.STATE, { state:this.state, exercise:this.id });
    return { value:v, confidence:this.lastConfidence || 0, state:this.state, formOK:formaOK };
  }
}

export function createDetector(exerciseId){ return new ExerciseDetector(exerciseId); }

// ═══════════════════════════════════════════════════════════════
// 🧍 ENQUADRAMENTO — o app orienta o jogador em vez de presumir
// que ele sabe posicionar o celular.
// ═══════════════════════════════════════════════════════════════
export const REQUIRED_KEYPOINTS = {
  flexao:      ['left_shoulder','right_shoulder','left_elbow','right_elbow','left_wrist','right_wrist','left_hip','right_hip'],
  // De frente o quadril fica atrás do corpo e as mãos somem debaixo dele.
  // Cabeça e ombros são os que sempre aparecem — e o BlazePose ESTIMA os
  // outros mesmo ocultos, então a medida continua vindo.
  flexao_frontal: ['nose','left_shoulder','right_shoulder'],
  // de perfil, deitado: ombro, quadril e joelho é o que a medida precisa.
  // Tornozelo fica de fora — costuma sair do quadro quando o celular está perto.
  abdominal: ['left_shoulder','right_shoulder','left_hip','right_hip','left_knee','right_knee'],
  polichinelo: ['left_shoulder','right_shoulder','left_wrist','right_wrist','left_hip','right_hip','left_ankle','right_ankle'],
};

// Quanto cada exercício exige antes de deixar a batalha começar.
// Acrescentar exercício = acrescentar linha, não lógica.
export const FRAMING_RULES = {
  padrao: {
    minRatio: 0.75, checarBordas: true, framesParaIniciar: 8,
    travaContagem: false, memoriaMs: 0,
  },
  flexao_frontal: {
    minRatio: 0.60,          // 2 dos 3 pontos bastam
    checarBordas: false,     // de frente, braços e pernas encostam nas bordas e está tudo certo
    framesParaIniciar: 3,    // reconheceu, começa
    travaContagem: true,     // começou a contar, não volta atrás
    memoriaMs: 1200,
  },
};
export const framingRule = id => FRAMING_RULES[id] || FRAMING_RULES.padrao;

// Além do veredito, devolve os NÚMEROS que o produziram: quantos pontos
// passaram e qual foi o melhor sinal. Sem eles "Procurando você…" é um beco
// sem saída — não dá para distinguir "falta corpo no quadro" de "o mínimo
// exigido está alto demais para esta câmera".
export function checkFraming(pose, exerciseId, MIN_SCORE){
  const required = REQUIRED_KEYPOINTS[exerciseId] || [];
  const regra    = framingRule(exerciseId);
  if(!pose) return { ok:false, level:'none', seen:0, total:required.length, best:0, alvo:0,
                     msg:'Procurando você… fique visível para a câmera.' };

  const scores  = required.map(n => { const p = kp(pose,n); return (p && p.score) || 0; });
  const visible = required.filter(n => { const p = kp(pose,n); return p && p.score > MIN_SCORE; });
  const ratio   = visible.length / required.length;

  // "alvo" é a confiança mínima que FARIA este quadro passar: como basta uma
  // fração dos pontos, é a nota do último que entra na conta, não a do melhor.
  const ordenados = scores.slice().sort((a,b)=> b-a);
  const precisa   = Math.max(1, Math.ceil(required.length * regra.minRatio));
  const alvo      = ordenados[precisa-1] || 0;
  const sinalFraco = alvo >= 0.08;
  const diag = { seen:visible.length, total:required.length, best:ordenados[0] || 0, alvo };
  const veredito = o => Object.assign(o, diag);
  const MSG_FRACO = '⚠️ Sinal fraco — mais luz no corpo, ou exija menos confiança.';

  if(ratio === 0)            return veredito({ ok:false, level:'none',
                               msg: sinalFraco ? MSG_FRACO : 'Procurando você… fique visível para a câmera.' });
  if(ratio < regra.minRatio) return veredito({ ok:false, level:'partial',
                               msg: sinalFraco ? MSG_FRACO : '⚠️ Corpo parcialmente fora do quadro — afaste o celular.' });

  const pts = visible.map(n=>kp(pose,n));
  const xs = pts.map(p=>p.x), ys = pts.map(p=>p.y);
  const w = pose.__vw || 1, h = pose.__vh || 1;
  const margin = 0.02;
  const cortado = Math.min(...xs) < w*margin || Math.max(...xs) > w*(1-margin) ||
                  Math.min(...ys) < h*margin || Math.max(...ys) > h*(1-margin);
  if(regra.checarBordas && cortado && ratio < 1)
    return veredito({ ok:false, level:'partial', msg:'⚠️ Parte do corpo está cortada — afaste o celular.' });
  return veredito({ ok:true, level:'ok', msg:'✓ Posição adequada' });
}

// ═══════════════════════════════════════════════════════════════
// 🩹 ESTABILIDADE DO VEREDITO
// Um quadro isolado ruim não pode desfazer o que vinte quadros bons
// construíram. Memória 0 = desligado, e é o que os outros exercícios usam.
// ═══════════════════════════════════════════════════════════════
export const Estabilidade = {
  tOK: 0, ultimo: null,
  filtrar(framing, memoriaMs, agora){
    if(framing.ok){ this.tOK = agora; this.ultimo = framing; return framing; }
    if(memoriaMs > 0 && this.ultimo && agora - this.tOK < memoriaMs)
      return Object.assign({}, framing, { ok:true, level:'ok', msg:this.ultimo.msg });
    return framing;
  },
  reset(){ this.tOK = 0; this.ultimo = null; }
};
