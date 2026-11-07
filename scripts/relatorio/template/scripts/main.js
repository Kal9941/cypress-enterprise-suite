/**
 * Ponto de entrada: inicia o que a página atual tem (índice ou suíte).
 */
document.addEventListener('DOMContentLoaded', () => {
  window.ReportTheme?.init();
  window.ReportModal?.init();

  // Índice
  if (typeof chartData !== 'undefined' && window.ReportCharts) {
    window.ReportCharts.initDashboard(chartData);
    window.ReportTable?.init(chartData);
  }

  // Página da suíte
  if (typeof featureData !== 'undefined' && window.ReportCharts) {
    window.ReportCharts.initFeature(featureData);
    window.ReportScenarios?.init(featureData);
  }
});
