/**
 * Funções compartilhadas do painel: escape de HTML, formatação de duração,
 * cores e rótulos de status. Tudo em português do Brasil.
 */
window.ReportUtils = {
  // Ordem fixa dos status em gráficos e legendas
  STATUS: ['passed', 'failed', 'skipped', 'skippedMassa'],

  ROTULOS: {
    passed: 'Passou',
    failed: 'Falhou',
    skipped: 'Pulado (backlog)',
    skippedMassa: 'Pulado por falta de massa',
  },

  clear: (seletor) => {
    const el = document.querySelector(seletor);
    if (el) el.innerHTML = '';
  },

  isDark: () => document.documentElement.classList.contains('dark'),

  getTextColor: () => (window.ReportUtils.isDark() ? '#94a3b8' : '#64748b'),

  getGridColor: () => (window.ReportUtils.isDark() ? '#334155' : '#e2e8f0'),

  // As cores de status vêm do painel.css (variáveis --c-*), para o gráfico e o CSS combinarem
  coresStatus: () => {
    const css = getComputedStyle(document.documentElement);
    const cor = (nome, padrao) => css.getPropertyValue(`--c-${nome}`).trim() || padrao;
    return {
      passed: cor('passed', '#059669'),
      failed: cor('failed', '#dc2626'),
      skipped: cor('skipped', '#64748b'),
      skippedMassa: cor('massa', '#d97706'),
    };
  },

  escape: (texto) =>
    String(texto === null || texto === undefined ? '' : texto)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;'),

  // 340 -> "340 ms"; 2400 -> "2,4 s"; 83000 -> "1 min 23 s"
  duracao: (ms) => {
    if (ms === null || ms === undefined || isNaN(ms)) return '—';
    if (ms < 1000) return `${Math.round(ms)} ms`;
    if (ms < 10000) return `${(ms / 1000).toFixed(1).replace('.', ',')} s`;
    const totalS = Math.round(ms / 1000);
    if (totalS < 60) return `${totalS} s`;
    const min = Math.floor(totalS / 60);
    const s = totalS % 60;
    if (min < 60) return `${min} min ${s} s`;
    return `${Math.floor(min / 60)} h ${min % 60} min`;
  },

  cortar: (texto, max) => {
    const t = String(texto || '');
    return t.length > max ? `${t.slice(0, max - 1)}…` : t;
  },

  // Copia para a área de transferência (com plano B para navegadores sem a API)
  copiar: (texto) => {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      return navigator.clipboard.writeText(texto);
    }
    return new Promise((resolve, reject) => {
      const area = document.createElement('textarea');
      area.value = texto;
      area.style.position = 'fixed';
      area.style.opacity = '0';
      document.body.appendChild(area);
      area.select();
      try {
        document.execCommand('copy') ? resolve() : reject(new Error('copy'));
      } catch (e) {
        reject(e);
      } finally {
        area.remove();
      }
    });
  },
};
