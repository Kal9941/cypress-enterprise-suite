/**
 * Modal de anexos (captura de tela ou log). O conteúdo vem de featureData
 * (o botão só guarda "índice do teste.índice do anexo"), então nada de dado do
 * relatório passa por innerHTML: tudo é montado com textContent.
 */
window.ReportModal = {
  textoAtual: '',

  init: () => {
    document.addEventListener('click', (e) => {
      const gatilho = e.target.closest('.modal-trigger');
      if (gatilho && typeof featureData !== 'undefined') {
        const [i, j] = (gatilho.dataset.ref || '').split('.').map(Number);
        const anexo = featureData.cenarios?.[i]?.anexos?.[j];
        if (anexo) window.ReportModal.abrir(anexo);
      }
    });

    document.getElementById('media-modal')?.addEventListener('click', (e) => {
      if (e.target.id === 'media-modal') window.ReportModal.fechar();
    });
    document.getElementById('modal-fechar')?.addEventListener('click', () => window.ReportModal.fechar());
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') window.ReportModal.fechar();
    });
  },

  fechar: () => {
    document.getElementById('media-modal')?.classList.remove('aberto');
    document.body.style.overflow = '';
  },

  // Endereço do anexo: dataUri embutido ou arquivo relativo ao painel (a página da suíte fica em features/)
  endereco: (anexo) => anexo.dataUri || (anexo.arquivo ? `../${anexo.arquivo}` : ''),

  // Texto de um data URI (base64 ou percent-encoding), em UTF-8
  textoDoDataUri: (uri) => {
    const virgula = uri.indexOf(',');
    if (virgula < 0) return '';
    const cabecalho = uri.slice(0, virgula);
    const dados = uri.slice(virgula + 1);
    try {
      if (/;base64/i.test(cabecalho)) {
        const bin = atob(dados);
        const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
        return new TextDecoder('utf-8').decode(bytes);
      }
      return decodeURIComponent(dados);
    } catch (e) {
      return '';
    }
  },

  abrir: (anexo) => {
    const modal = document.getElementById('media-modal');
    const titulo = document.getElementById('modal-title');
    const corpo = document.getElementById('modal-content');
    if (!modal || !titulo || !corpo) return;

    titulo.textContent = anexo.titulo || 'Anexo';
    corpo.textContent = '';
    window.ReportModal.textoAtual = '';
    const url = window.ReportModal.endereco(anexo);

    if (anexo.tipo === 'screenshot') {
      const img = document.createElement('img');
      img.alt = anexo.titulo || 'Captura de tela';
      img.onerror = () => {
        corpo.textContent = 'Não foi possível carregar a imagem (arquivo ausente ou fora do painel).';
      };
      img.src = url;
      corpo.appendChild(img);
    } else {
      const texto = anexo.dataUri ? window.ReportModal.textoDoDataUri(anexo.dataUri) : '';
      if (texto) {
        window.ReportModal.textoAtual = texto;
        const barra = document.createElement('div');
        barra.className = 'mb-2 flex justify-end';
        const botao = document.createElement('button');
        botao.type = 'button';
        botao.className = 'pn-botao';
        botao.innerHTML = '<i class="fa-solid fa-copy"></i><span>Copiar log</span>';
        botao.addEventListener('click', () => window.ReportUtils.copiar(texto).then(() => {
          botao.lastChild.textContent = 'Copiado!';
          setTimeout(() => (botao.lastChild.textContent = 'Copiar log'), 1800);
        }));
        barra.appendChild(botao);
        const pre = document.createElement('pre');
        pre.className = 'pn-codigo';
        pre.textContent = texto;
        corpo.appendChild(barra);
        corpo.appendChild(pre);
      } else if (url) {
        const link = document.createElement('a');
        link.href = url;
        link.target = '_blank';
        link.rel = 'noopener';
        link.className = 'pn-link';
        link.textContent = `Abrir ${anexo.arquivo || 'arquivo'} em outra aba`;
        corpo.appendChild(link);
      } else {
        corpo.textContent = 'Anexo sem conteúdo.';
      }
    }

    modal.classList.add('aberto');
    document.body.style.overflow = 'hidden';
  },
};
