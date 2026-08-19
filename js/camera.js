// ═══════════════════════════════════════════════════════════════
// 📷 CONTROLE DE CÂMERA
// Abrir, trocar, encerrar e — principalmente — explicar o que deu errado
// em português, em vez de deixar a tela quebrada.
// Nenhum quadro de vídeo sai do aparelho: quem processa é o navegador.
// ═══════════════════════════════════════════════════════════════

export class CameraError extends Error{
  constructor(kind, msg){ super(msg); this.kind = kind; }
}

export function describeCameraError(err){
  if(err && (err.kind === 'model' || err instanceof CameraError)) return err.message;
  const n = err && err.name;
  if(n==='NotAllowedError' || n==='PermissionDeniedError')
    return window.isSecureContext
      ? 'Você negou o acesso à câmera. Libere a permissão nas configurações e tente novamente.'
      : 'O acesso à câmera foi bloqueado porque o app não está sendo aberto por um endereço seguro (https://).';
  if(n==='NotFoundError' || n==='DevicesNotFoundError')
    return 'Nenhuma câmera foi encontrada neste aparelho.';
  if(n==='NotReadableError' || n==='TrackStartError')
    return 'A câmera já está sendo usada por outro aplicativo. Feche o outro app e tente de novo.';
  if(n==='OverconstrainedError')
    return 'Esta câmera não suporta a resolução pedida. Tente trocar de câmera.';
  if(n==='SecurityError')
    return 'O navegador bloqueou a câmera. Abra a página por HTTPS para liberar o acesso.';
  return (err && err.message) ? err.message
    : 'Não foi possível acessar a câmera. Verifique as permissões do navegador e tente novamente.';
}

// WebViews e navegadores antigos não expõem navigator.mediaDevices, mas ainda
// trazem a API antiga com prefixo. Um único ponto de entrada para os dois casos.
function pedirCamera(constraints){
  if(navigator.mediaDevices && navigator.mediaDevices.getUserMedia)
    return navigator.mediaDevices.getUserMedia(constraints);
  const legado = navigator.getUserMedia || navigator.webkitGetUserMedia
              || navigator.mozGetUserMedia || navigator.msGetUserMedia;
  if(!legado) return null;
  return new Promise((res, rej)=> legado.call(navigator, constraints, res, rej));
}

let facingAtual = 'user';
export const facing = () => facingAtual;
export function alternarFacing(){
  facingAtual = (facingAtual === 'user') ? 'environment' : 'user';
  return facingAtual;
}

export async function openCamera(videoEl, facingDesejado){
  facingAtual = facingDesejado || facingAtual;
  const constraints = { video:{ facingMode:facingAtual, width:{ideal:720}, height:{ideal:960} }, audio:false };
  const pedido = pedirCamera(constraints);
  if(!pedido){
    // Sem NENHUMA API de câmera: quase sempre é contexto inseguro. O navegador
    // remove a API inteira quando a página não vem por https:// (ou localhost),
    // e é por isso que nem chega a aparecer pedido de permissão.
    throw new CameraError('unsupported', window.isSecureContext
      ? 'Este navegador não oferece acesso à câmera. Tente pelo Chrome ou Safari atualizado.'
      : 'A câmera só funciona em endereço seguro (https://). Este app foi aberto por '
        + (location.protocol || 'file:') + ', e o navegador desativa a câmera nesse caso.');
  }
  const stream = await pedido;
  videoEl.srcObject = stream;
  await new Promise((res, rej)=>{
    const t = setTimeout(()=>rej(new CameraError('timeout','A câmera demorou demais para responder. Tente novamente.')), 10000);
    videoEl.onloadedmetadata = ()=>{ clearTimeout(t); res(); };
  });
  await videoEl.play();
  return stream;
}

// encerra o stream por completo — sem vazamento de câmera/memória ao sair da tela
export function stopStream(videoEl){
  if(videoEl.srcObject){ videoEl.srcObject.getTracks().forEach(t=>t.stop()); videoEl.srcObject=null; }
}

export async function hasMultipleCameras(){
  try{
    if(!navigator.mediaDevices || !navigator.mediaDevices.enumerateDevices) return false;
    const devs = await navigator.mediaDevices.enumerateDevices();
    return devs.filter(d=>d.kind==='videoinput').length > 1;
  }catch(e){ return false; }
}

// preserva a proporção do vídeo — nada de imagem deformada
export function fitCanvas(canvas, videoEl){
  const r = videoEl.getBoundingClientRect();
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = Math.round(r.width * dpr);
  canvas.height = Math.round(r.height * dpr);
  canvas.style.width = r.width+'px';
  canvas.style.height = r.height+'px';
}
