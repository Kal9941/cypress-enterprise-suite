/**
 * Tema claro/escuro. A escolha fica no localStorage; sem escolha, vale a
 * preferência do sistema. O <head> de cada página já aplica a classe "dark"
 * antes de pintar (evita o "pisca"); aqui só se cuida do botão e dos gráficos.
 */
window.ReportTheme = {
  CHAVE: 'omnicare-relatorio-tema',

  init: () => {
    const botao = document.getElementById('theme-toggle');
    const sol = document.getElementById('sun-icon');
    const lua = document.getElementById('moon-icon');

    const atualizarIcones = () => {
      const escuro = document.documentElement.classList.contains('dark');
      sol?.classList.toggle('pn-oculto', !escuro);
      lua?.classList.toggle('pn-oculto', escuro);
    };
    atualizarIcones();

    botao?.addEventListener('click', () => {
      const escuro = !document.documentElement.classList.contains('dark');
      document.documentElement.classList.toggle('dark', escuro);
      try {
        localStorage.setItem(window.ReportTheme.CHAVE, escuro ? 'dark' : 'light');
      } catch (e) {
        // localStorage bloqueado: o tema só vale nesta página
      }
      atualizarIcones();

      // Recria os gráficos para pegar as cores do novo tema
      if (typeof chartData !== 'undefined') window.ReportCharts.initDashboard(chartData);
      if (typeof featureData !== 'undefined') window.ReportCharts.initFeature(featureData);
    });
  },
};
