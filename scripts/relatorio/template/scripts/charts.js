/**
 * Gráficos do painel (ApexCharts local). Dois pontos de entrada:
 *  - initDashboard(chartData): índice da execução
 *  - initFeature(featureData): página de uma suíte
 */
window.ReportCharts = {
  instancias: [],

  // Opções comuns a todos os gráficos, já com as cores do tema atual
  base: () => {
    const U = window.ReportUtils;
    const cores = U.coresStatus();
    return {
      theme: U.isDark() ? 'dark' : 'light',
      texto: U.getTextColor(),
      grade: U.getGridColor(),
      cores,
      coresStatus: U.STATUS.map((s) => cores[s]),
      rotulosStatus: U.STATUS.map((s) => U.ROTULOS[s]),
    };
  },

  // Cria o gráfico em #id; se não houver dado, mostra a mensagem no lugar
  desenhar: (seletor, opcoes, vazio) => {
    const el = document.querySelector(seletor);
    if (!el) return;
    el.innerHTML = '';
    if (vazio) {
      el.innerHTML = `<div class="pn-vazio">${window.ReportUtils.escape(vazio)}</div>`;
      return;
    }
    const grafico = new ApexCharts(el, opcoes);
    window.ReportCharts.instancias.push(grafico);
    grafico.render();
  },

  limpar: () => {
    window.ReportCharts.instancias.forEach((g) => {
      try {
        g.destroy();
      } catch (e) {
        // gráfico já removido do DOM
      }
    });
    window.ReportCharts.instancias = [];
  },

  // Rosca de status (passou, falhou, pulado, pulado por falta de massa)
  rosca: (seletor, totais, rotuloCentro) => {
    const C = window.ReportCharts;
    const b = C.base();
    const serie = window.ReportUtils.STATUS.map((s) => totais[s] || 0);
    const total = serie.reduce((a, v) => a + v, 0);
    C.desenhar(
      seletor,
      {
        series: serie,
        labels: b.rotulosStatus,
        colors: b.coresStatus,
        chart: { type: 'donut', height: 270, animations: { enabled: false }, toolbar: { show: false }, foreColor: b.texto },
        dataLabels: { enabled: false },
        stroke: { width: 2, colors: [window.ReportUtils.isDark() ? '#262626' : '#ffffff'] },
        legend: {
          position: 'bottom',
          fontSize: '12px',
          labels: { colors: b.texto },
          formatter: (nome, opts) => `${nome}: ${opts.w.globals.series[opts.seriesIndex]}`,
        },
        tooltip: {
          theme: b.theme,
          y: {
            formatter: (v) => `${v} (${total ? ((v / total) * 100).toFixed(1).replace('.', ',') : '0'}%)`,
          },
        },
        plotOptions: {
          pie: {
            donut: {
              size: '66%',
              labels: {
                show: true,
                total: { show: true, showAlways: true, label: rotuloCentro, color: b.texto, fontSize: '12px', formatter: () => String(total) },
                value: { show: true, color: b.texto, fontSize: '22px', fontWeight: 'bold' },
              },
            },
          },
        },
      },
      total === 0 ? 'Nenhum teste nesta execução.' : null,
    );
  },

  // Barras horizontais empilhadas por status (suítes, contextos)
  barrasStatus: (seletor, categorias, linhas, opcoes = {}) => {
    const C = window.ReportCharts;
    const b = C.base();
    const U = window.ReportUtils;
    const series = U.STATUS.map((s) => ({ name: U.ROTULOS[s], data: linhas.map((l) => l[s] || 0) }));
    const maior = Math.max(1, ...linhas.map((l) => U.STATUS.reduce((a, s) => a + (l[s] || 0), 0)));
    C.desenhar(
      seletor,
      {
        series,
        chart: {
          type: 'bar',
          height: Math.max(opcoes.alturaMin || 220, categorias.length * 34 + 90),
          stacked: true,
          toolbar: { show: false },
          animations: { enabled: false },
          foreColor: b.texto,
          events: opcoes.aoClicar ? { dataPointSelection: (e, ctx, cfg) => opcoes.aoClicar(cfg.dataPointIndex) } : {},
        },
        colors: b.coresStatus,
        plotOptions: { bar: { horizontal: true, borderRadius: 3, barHeight: '68%' } },
        xaxis: {
          categories: categorias,
          min: 0,
          max: maior,
          tickAmount: Math.min(maior, 10),
          labels: { style: { colors: b.texto }, formatter: (v) => String(Math.round(v)) },
        },
        yaxis: { labels: { style: { colors: b.texto, fontSize: '11px' }, maxWidth: opcoes.larguraRotulo || 230 } },
        dataLabels: { enabled: false },
        grid: { borderColor: b.grade },
        legend: { position: 'top', horizontalAlign: 'left', labels: { colors: b.texto } },
        tooltip: { theme: b.theme },
        states: opcoes.aoClicar ? { hover: { filter: { type: 'lighten', value: 0.08 } } } : {},
      },
      categorias.length === 0 ? 'Sem dados.' : null,
    );
  },

  initDashboard: (data) => {
    const C = window.ReportCharts;
    const U = window.ReportUtils;
    const b = C.base();
    C.limpar();

    // 1. Status geral dos testes
    C.rosca('#grafico-status', data.resumo, 'Testes');

    // 2. Status por suíte (clicar na barra abre a suíte)
    const specs = data.specs || [];
    C.barrasStatus(
      '#grafico-suites',
      specs.map((s) => s.id),
      specs.map((s) => s.totais || {}),
      { alturaMin: 330, aoClicar: (i) => specs[i] && (window.location.href = `features/${specs[i].slug}.html`) },
    );

    // 3. Falhas por categoria
    const cats = (data.falhasPorCategoria || []).slice().sort((x, y) => y.qtd - x.qtd);
    C.desenhar(
      '#grafico-categorias',
      {
        series: [{ name: 'Falhas', data: cats.map((c) => c.qtd) }],
        chart: { type: 'bar', height: Math.max(220, cats.length * 38 + 70), toolbar: { show: false }, animations: { enabled: false }, foreColor: b.texto },
        colors: [b.cores.failed],
        plotOptions: { bar: { horizontal: true, borderRadius: 3, barHeight: '60%' } },
        dataLabels: { enabled: true, style: { colors: ['#ffffff'], fontSize: '11px' } },
        xaxis: {
          categories: cats.map((c) => c.categoria),
          min: 0,
          tickAmount: Math.min(5, Math.max(1, ...cats.map((c) => c.qtd))),
          labels: { style: { colors: b.texto }, formatter: (v) => String(Math.round(v)) },
        },
        yaxis: {
          labels: {
            style: { colors: b.texto, fontSize: '10px' },
            maxWidth: 260,
            formatter: (v) => (typeof v === 'string' ? U.cortar(v, 44) : v),
          },
        },
        grid: { borderColor: b.grade },
        tooltip: { theme: b.theme },
      },
      cats.length === 0 ? 'Nenhuma falha nesta execução.' : null,
    );

    // 4. Testes por área
    const areas = data.areas || [];
    C.desenhar(
      '#grafico-areas',
      {
        series: [
          { name: U.ROTULOS.passed, data: areas.map((a) => a.passed || 0) },
          { name: U.ROTULOS.failed, data: areas.map((a) => a.failed || 0) },
          { name: 'Pulado', data: areas.map((a) => a.skipped || 0) },
        ],
        chart: { type: 'bar', height: Math.max(220, areas.length * 34 + 90), stacked: true, toolbar: { show: false }, animations: { enabled: false }, foreColor: b.texto },
        colors: [b.cores.passed, b.cores.failed, b.cores.skipped],
        plotOptions: { bar: { horizontal: true, borderRadius: 3, barHeight: '68%' } },
        xaxis: { categories: areas.map((a) => a.area), labels: { style: { colors: b.texto } } },
        yaxis: { labels: { style: { colors: b.texto, fontSize: '11px' }, maxWidth: 200 } },
        dataLabels: { enabled: false },
        grid: { borderColor: b.grade },
        legend: { position: 'top', horizontalAlign: 'left', labels: { colors: b.texto } },
        tooltip: { theme: b.theme },
      },
      areas.length === 0 ? 'Nenhuma área informada.' : null,
    );
  },

  initFeature: (spec) => {
    const C = window.ReportCharts;
    const U = window.ReportUtils;
    const b = C.base();
    C.limpar();

    // 1. Status da suíte
    C.rosca('#grafico-status', spec.totais || {}, 'Testes');

    // 2. Testes mais lentos (top 10)
    const lentos = (spec.cenarios || [])
      .filter((c) => (c.duracaoMs || 0) > 0)
      .sort((x, y) => y.duracaoMs - x.duracaoMs)
      .slice(0, 10);
    const paleta = ['#ef4444', '#f97316', '#f59e0b', '#eab308', '#84cc16', '#22c55e', '#10b981', '#06b6d4', '#3b82f6', '#6366f1'];
    C.desenhar(
      '#grafico-lentos',
      {
        series: [{ name: 'Duração', data: lentos.map((c) => c.duracaoMs / 1000) }],
        chart: { type: 'bar', height: Math.max(240, lentos.length * 32 + 60), toolbar: { show: false }, animations: { enabled: false }, foreColor: b.texto },
        colors: paleta,
        plotOptions: { bar: { horizontal: true, borderRadius: 3, barHeight: '70%', distributed: true, dataLabels: { position: 'top' } } },
        dataLabels: {
          enabled: true,
          textAnchor: 'start',
          offsetX: 6,
          style: { colors: [b.texto], fontSize: '10px', fontWeight: 'bold' },
          formatter: (v) => U.duracao(v * 1000),
        },
        xaxis: { categories: lentos.map((c) => `${c.id} ${U.cortar(c.titulo, 38)}`), labels: { style: { colors: b.texto }, formatter: (v) => (typeof v === 'number' ? U.duracao(v * 1000) : v) } },
        yaxis: { labels: { style: { colors: b.texto, fontSize: '10px' }, maxWidth: 300 } },
        grid: { borderColor: b.grade },
        legend: { show: false },
        tooltip: { theme: b.theme, y: { formatter: (v) => U.duracao(v * 1000) } },
      },
      lentos.length === 0 ? 'Nenhum teste com duração registrada.' : null,
    );

    // 3. Status por contexto
    const contextos = spec.contexts || [];
    C.barrasStatus(
      '#grafico-contextos',
      contextos.map((c) => `${c.numero} · ${U.cortar(c.nome, 48)}`),
      contextos.map((c) => c.totais || {}),
      { larguraRotulo: 320 },
    );
  },
};
