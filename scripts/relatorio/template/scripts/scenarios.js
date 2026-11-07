/**
 * Lista de testes da página da suíte: filtros (status, contexto, área, texto),
 * expandir/recolher tudo, copiar erro e abrir um teste pelo #âncora.
 */
window.ReportScenarios = {
  init: () => {
    const cartoes = Array.from(document.querySelectorAll('.pn-teste'));
    const botoesStatus = document.querySelectorAll('.filtro-status');
    const campoBusca = document.getElementById('busca-testes');
    const seletorContexto = document.getElementById('filtro-contexto');
    const seletorArea = document.getElementById('filtro-area');
    const vazio = document.getElementById('testes-vazio');
    const contador = document.getElementById('testes-contador');

    const estado = { status: 'all', busca: '', contexto: '', area: '' };

    const aplicar = () => {
      let visiveis = 0;
      cartoes.forEach((c) => {
        const areas = (c.dataset.areas || '').split('|');
        const ok =
          (estado.status === 'all' || c.dataset.status === estado.status) &&
          (estado.contexto === '' || c.dataset.ctx === estado.contexto) &&
          (estado.area === '' || areas.includes(estado.area)) &&
          (estado.busca === '' || (c.dataset.busca || '').includes(estado.busca));
        c.classList.toggle('pn-oculto', !ok);
        if (ok) visiveis++;
      });
      vazio?.classList.toggle('hidden', visiveis > 0);
      if (contador) contador.textContent = `${visiveis} de ${cartoes.length} testes`;
    };

    botoesStatus.forEach((b) => {
      b.addEventListener('click', () => {
        estado.status = b.dataset.status;
        botoesStatus.forEach((x) => x.classList.toggle('ativo', x === b));
        aplicar();
      });
    });
    campoBusca?.addEventListener('input', (e) => {
      estado.busca = e.target.value.toLowerCase().trim();
      aplicar();
    });
    seletorContexto?.addEventListener('change', (e) => {
      estado.contexto = e.target.value;
      aplicar();
    });
    seletorArea?.addEventListener('change', (e) => {
      estado.area = e.target.value;
      aplicar();
    });

    // Clicar numa linha da tabela de contextos filtra a lista por ele
    document.querySelectorAll('[data-filtra-contexto]').forEach((el) => {
      el.addEventListener('click', (e) => {
        if (e.target.closest('a')) return; // links de issue/PR seguem o seu caminho
        const valor = el.dataset.filtraContexto;
        estado.contexto = estado.contexto === valor ? '' : valor;
        if (seletorContexto) seletorContexto.value = estado.contexto;
        aplicar();
        if (estado.contexto) document.getElementById('lista-testes')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    });

    document.getElementById('expandir-todos')?.addEventListener('click', () => {
      cartoes.filter((c) => !c.classList.contains('pn-oculto')).forEach((c) => (c.open = true));
    });
    document.getElementById('recolher-todos')?.addEventListener('click', () => {
      cartoes.forEach((c) => (c.open = false));
    });

    // Botões "Copiar" (erro): copiam o texto do bloco indicado
    document.addEventListener('click', (e) => {
      const botao = e.target.closest('.pn-copiar');
      if (!botao) return;
      const alvo = document.getElementById(botao.dataset.alvo);
      if (!alvo) return;
      window.ReportUtils.copiar(alvo.textContent).then(() => {
        const rotulo = botao.querySelector('span');
        if (!rotulo) return;
        const original = rotulo.textContent;
        rotulo.textContent = 'Copiado!';
        setTimeout(() => (rotulo.textContent = original), 1800);
      });
    });

    // Link direto para um teste: features/<slug>.html#t-0-C-3-1
    const abrirPelaAncora = () => {
      const alvo = location.hash ? document.getElementById(decodeURIComponent(location.hash.slice(1))) : null;
      if (alvo && alvo.classList.contains('pn-teste')) {
        alvo.open = true;
        alvo.scrollIntoView({ block: 'start' });
      }
    };
    abrirPelaAncora();
    window.addEventListener('hashchange', abrirPelaAncora);

    aplicar();
  },
};
