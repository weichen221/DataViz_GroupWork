const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const sections = [
  { id: 'overview', label: 'Overview' },
  { id: 'flood-records', label: 'Flood Records' },
  { id: 'Time-patterns', label: 'Time Patterns' },
  { id: 'housing-exposure', label: 'Housing Exposure' },
  { id: 'market-context', label: 'Market Context', target: 'outer-trend-card' },
  { id: 'insights', label: 'Insights' },
  { id: 'team', label: 'Team' },
];

document.body.classList.add('experience-ready');

function createOpeningSplash() {
  const splash = document.createElement('div');
  splash.className = 'opening-splash';
  splash.setAttribute('aria-hidden', 'true');
  splash.innerHTML = `
    <div class="opening-splash-water"></div>
    <div class="opening-splash-spray" aria-hidden="true">
      <span></span><span></span><span></span><span></span><span></span><span></span>
    </div>
    <div class="opening-splash-crest" aria-hidden="true">
      <span></span>
      <span></span>
    </div>
    <div class="opening-splash-waves">
      <span></span>
      <span></span>
      <span></span>
    </div>
    <div class="opening-splash-content">
      <span class="opening-splash-kicker">Flood Risk Visualisation</span>
      <strong>UK Flood Explorer</strong>
      <em>Flood outlines · Urban exposure · Housing market signals</em>
      <div class="opening-splash-meter"><span></span></div>
    </div>
  `;

  document.documentElement.classList.add('splash-active');
  document.body.prepend(splash);

  const dismiss = () => {
    if (splash.classList.contains('is-leaving')) return;
    splash.classList.add('is-leaving');
    document.documentElement.classList.remove('splash-active');
    window.setTimeout(() => splash.remove(), prefersReducedMotion ? 80 : 780);
  };

  splash.addEventListener('click', dismiss, { once: true });
  window.setTimeout(dismiss, prefersReducedMotion ? 360 : 2400);
}

function createProgress() {
  const bar = document.createElement('div');
  bar.className = 'scroll-progress';
  bar.innerHTML = '<span></span>';
  document.body.prepend(bar);

  const fill = bar.firstElementChild;
  const update = () => {
    const max = document.documentElement.scrollHeight - window.innerHeight;
    const progress = max > 0 ? window.scrollY / max : 0;
    fill.style.transform = `scaleX(${Math.min(1, Math.max(0, progress))})`;
  };
  update();
  window.addEventListener('scroll', update, { passive: true });
  window.addEventListener('resize', update);
}

function createStoryRail() {
  const rail = document.createElement('nav');
  rail.className = 'story-rail';
  rail.setAttribute('aria-label', 'Story sections');

  rail.innerHTML = sections
    .map(({ id, label, target = id }) => {
      const exists = document.getElementById(target);
      if (!exists) return '';
      return `<a href="#${target}" data-rail-link="${id}" aria-label="${label}"><span>${label}</span></a>`;
    })
    .join('');

  if (!rail.innerHTML.trim()) return;
  document.body.append(rail);
}

function enhanceAnchors() {
  document.querySelectorAll('a[href^="#"]').forEach((link) => {
    link.addEventListener('click', (event) => {
      const id = link.getAttribute('href').slice(1);
      const target = document.getElementById(id);
      if (!target || prefersReducedMotion) return;
      event.preventDefault();
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      history.pushState(null, '', `#${id}`);
    });
  });
}

function revealOnScroll() {
  const revealTargets = [
    '.section-header',
    '.cover-text',
    '.cover-visual',
    '.cover-feature',
    '.fr-panel',
    '.map-card',
    '.legend-bar',
    '.city-stack',
    '.chart-grid',
    '.mc-transition-text',
    '.outer-trend-card',
    '.mc-city-card',
    '.conclusion-copy p',
    '.author-card',
    '.site-footer-inner',
  ];

  const elements = document.querySelectorAll(revealTargets.join(','));
  elements.forEach((el, index) => {
    el.classList.add('fx-reveal');
    el.style.setProperty('--fx-delay', `${Math.min(index % 6, 5) * 55}ms`);
  });

  if (prefersReducedMotion || !('IntersectionObserver' in window)) {
    elements.forEach((el) => el.classList.add('is-visible'));
    return;
  }

  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      entry.target.classList.add('is-visible');
      observer.unobserve(entry.target);
    });
  }, { rootMargin: '0px 0px -12% 0px', threshold: 0.16 });

  elements.forEach((el) => observer.observe(el));
}

function syncStoryRail() {
  const links = document.querySelectorAll('[data-rail-link]');
  const observed = sections
    .map(({ id, target = id }) => {
      const element = document.getElementById(target);
      if (element) element.dataset.railSection = id;
      return element;
    })
    .filter(Boolean);

  if (!links.length || !observed.length || !('IntersectionObserver' in window)) return;

  const setActive = (id) => {
    links.forEach((link) => link.classList.toggle('is-active', link.dataset.railLink === id));
  };

  const observer = new IntersectionObserver((entries) => {
    const visible = entries
      .filter((entry) => entry.isIntersecting)
      .sort((a, b) => b.intersectionRatio - a.intersectionRatio);
    if (visible[0]) setActive(visible[0].target.dataset.railSection || visible[0].target.id);
  }, { rootMargin: '-35% 0px -45% 0px', threshold: [0.1, 0.25, 0.5, 0.75] });

  observed.forEach((section) => observer.observe(section));
  setActive('overview');
}

function addCardTilt() {
  if (prefersReducedMotion) return;

  document.querySelectorAll('.cover-feature, .mc-city-card, .author-card, .outer-trend-card').forEach((card) => {
    card.classList.add('fx-tilt');
    card.addEventListener('pointermove', (event) => {
      const rect = card.getBoundingClientRect();
      const x = ((event.clientX - rect.left) / rect.width - 0.5) * 2;
      const y = ((event.clientY - rect.top) / rect.height - 0.5) * 2;
      card.style.setProperty('--tilt-x', `${(-y * 2.2).toFixed(2)}deg`);
      card.style.setProperty('--tilt-y', `${(x * 2.2).toFixed(2)}deg`);
      card.style.setProperty('--glow-x', `${((x + 1) / 2 * 100).toFixed(1)}%`);
      card.style.setProperty('--glow-y', `${((y + 1) / 2 * 100).toFixed(1)}%`);
    });
    card.addEventListener('pointerleave', () => {
      card.style.removeProperty('--tilt-x');
      card.style.removeProperty('--tilt-y');
      card.style.removeProperty('--glow-x');
      card.style.removeProperty('--glow-y');
    });
  });
}

function markTextEffects() {
  document.querySelectorAll('.cover-title, .section-title, .main-title, .mc-text-heading').forEach((el) => {
    el.classList.add('fx-title');
  });
  document.querySelectorAll('.mc-transition-question, .conclusion-copy p:last-child').forEach((el) => {
    el.classList.add('fx-question');
  });
}

createOpeningSplash();
createProgress();
createStoryRail();
markTextEffects();
enhanceAnchors();
revealOnScroll();
syncStoryRail();
addCardTilt();
