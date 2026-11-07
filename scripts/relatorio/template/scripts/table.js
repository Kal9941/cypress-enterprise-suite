/**
 * Tabela de suítes do índice: busca por texto, filtro por status e ordenação.
 * As linhas já vêm prontas no HTML; aqui só se esconde e se reordena.
 */
window.ReportTable = {
  init: () => {
    const corpo = document.getElementById('tabela-suites-corpo');
    if (!corpo) return;

    const linhas = Array.from(corpo.querySelectorAll('tr[data-nome]'));
    const campoBusca = document.getElementById('busca-suites');
    const botoes = document.querySelectorAll('.filtro-suite');
    const cabecalhos = document.querySelectorAll('th[data-ordem]');
    const vazio = document.getElementById('suites-vazio');
    const contador = document.getElementById('suites-contador');

    let busca = '';
    let filtro = 'todas';
    let ordem = null;
    let direcao = 1;

    const passaNoFiltro = (tr) => {
      const falhas = Number(tr.dataset.falhas);
      const pulos = Number(tr.dataset.pulos);
      if (filtro === 'falhas') return falhas > 0;
      if (filtro === 'pulos') return pulos > 0;
      if (filtro === 'ok') return falhas === 0;
      return true;
    };

    const aplicar = () => {
      let visiveis = 0;
      linhas.forEach((tr) => {
        const mostra = passaNoFiltro(tr) && (busca === '' || tr.dataset.nome.includes(busca));
        tr.classList.toggle('pn-oculto', !mostra);
        if (mostra) visiveis++;
      });

      if (ordem) {
        const ordenadas = linhas.slice().sort((a, b) => {
          const va = a.dataset[ordem];
          const vb = b.dataset[ordem];
          const cmp = ordem === 'nome' ? va.localeCompare(vb, 'pt-BR', { numeric: true }) : Number(va) - Number(vb);
          return cmp * direcao;
        });
        ordenadas.forEach((tr) => corpo.appendChild(tr));
      }

      vazio?.classList.toggle('hidden', visiveis > 0);
      if (contador) contador.textContent = `${visiveis} de ${linhas.length} suítes`;
    };

    campoBusca?.addEventListener('input', (e) => {
      busca = e.target.value.toLowerCase().trim();
      aplicar();
    });

    botoes.forEach((botao) => {
      botao.addEventListener('click', () => {
        filtro = botao.dataset.filtro;
        botoes.forEach((b) => b.classList.toggle('ativo', b === botao));
        aplicar();
      });
    });

    cabecalhos.forEach((th) => {
      th.addEventListener('click', () => {
        const nova = th.dataset.ordem;
        direcao = ordem === nova ? -direcao : 1;
        ordem = nova;
        cabecalhos.forEach((c) => {
          const seta = c.querySelector('.pn-seta-ordem');
          if (seta) seta.className = `pn-seta-ordem fa-solid ${c === th ? (direcao === 1 ? 'fa-sort-up' : 'fa-sort-down') : 'fa-sort'} opacity-40`;
        });
        aplicar();
      });
    });

    aplicar();
  },
};
