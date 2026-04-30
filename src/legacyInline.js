/* ============================================================
     COVER (DARK) — sticky-nav state, active section tracking,
     dark hero-map render, and feature-card motif generators.
     ============================================================ */
  (function () {
    /* ---- 1. Sticky nav: shadow / opacity on scroll ---- */
    const nav = document.getElementById('site-nav');
    const onScroll = () => {
      if (!nav) return;
      nav.classList.toggle('is-scrolled', window.scrollY > 8);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();

    /* ---- 2. Active nav link via IntersectionObserver ---- */
    const navLinks = document.querySelectorAll('.site-nav-links a[data-nav-link]');
    const sectionIds = ['overview','flood-records','Time-patterns','housing-exposure','insights','team'];
    const sections = sectionIds
      .map(id => document.getElementById(id))
      .filter(Boolean);

    if ('IntersectionObserver' in window && sections.length) {
      const setActive = (id) => {
        navLinks.forEach(a => a.classList.toggle('is-active', a.dataset.navLink === id));
      };
      const io = new IntersectionObserver((entries) => {
        // Pick the entry whose ratio is highest among intersecting entries.
        const visible = entries
          .filter(e => e.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio);
        if (visible[0]) setActive(visible[0].target.id);
      }, { rootMargin: '-40% 0px -50% 0px', threshold: [0, 0.25, 0.5, 0.75, 1] });
      sections.forEach(s => io.observe(s));
      setActive('overview');
    }

    /* ---- 3. Feature-card motifs (bars + pixel grid) ---- */
    function drawBarsMotif() {
      const g = document.querySelector('.cover-feature--teal .cover-motif-bars');
      if (!g) return;
      const W = 200, BAR_W = 4, GAP = 2, BASE = 36;
      const N = Math.floor(W / (BAR_W + GAP));
      // Pseudo-random heights with a gentle wave so it reads as seasonal data.
      let svgInner = '';
      for (let i = 0; i < N; i++) {
        const wave = Math.sin(i / 3.2) * 0.35 + Math.sin(i / 1.4) * 0.15 + 0.55;
        const noise = (Math.sin(i * 12.9898) * 43758.5453) % 1;
        const h = Math.max(3, Math.min(34, wave * 26 + Math.abs(noise) * 6));
        const x = i * (BAR_W + GAP);
        const y = BASE - h;
        const op = 0.55 + (h / 34) * 0.4;
        svgInner += `<rect x="${x}" y="${y.toFixed(1)}" width="${BAR_W}" height="${h.toFixed(1)}" rx="0.6" opacity="${op.toFixed(2)}"/>`;
      }
      // overlay a thin trend dotted line on top of bars
      let dots = '';
      for (let i = 0; i < N; i += 2) {
        const wave = Math.sin(i / 3.2) * 0.35 + Math.sin(i / 1.4) * 0.15 + 0.55;
        const h = wave * 26 + 4;
        const cx = i * (BAR_W + GAP) + BAR_W / 2;
        const cy = BASE - h - 2;
        dots += `<circle cx="${cx}" cy="${cy.toFixed(1)}" r="1" opacity="0.85"/>`;
      }
      g.innerHTML = svgInner + dots;
    }

    function drawPixelMotif() {
      const g = document.querySelector('.cover-motif-pixels');
      if (!g) return;
      const COLS = 40, ROWS = 5, CELL = 4, GAP = 1;
      const xOff = 200 - (COLS * (CELL + GAP) - GAP);
      let inner = '';
      for (let r = 0; r < ROWS; r++) {
        for (let c = 0; c < COLS; c++) {
          // Diagonal density gradient + noise
          const t = (c / COLS) * 0.7 + (r / ROWS) * 0.3;
          const noise = ((Math.sin((c + 1) * 91 + r * 7) * 43758.5453) % 1 + 1) % 1;
          if (noise > 1 - t * 0.95) continue;
          const op = 0.25 + t * 0.65;
          const x = xOff + c * (CELL + GAP);
          const y = 8 + r * (CELL + GAP);
          inner += `<rect x="${x}" y="${y}" width="${CELL}" height="${CELL}" rx="0.6" opacity="${op.toFixed(2)}"/>`;
        }
      }
      g.innerHTML = inner;
    }

    drawBarsMotif();
    drawPixelMotif();

    /* ---- 4. Dark hero map render ---- */
    const MAP_URL = 'data/uk_flood_frequency_simplified.geojson';
    const NAME_FIELD = 'LAD25NM';
    const COUNT_FIELD = 'polygon_count';

    // Cities to highlight — actual study cities + visual placement helpers.
    // [name, lon, lat, label-anchor "left"|"right", optional pixel-offset (in svg viewBox units)]
    const CITIES = [
      { name: 'Hull',           lon: -0.336, lat: 53.745, side: 'right', delay: 0 },
      { name: 'York',           lon: -1.080, lat: 53.961, side: 'left',  delay: 1 },
      { name: 'Great Yarmouth', lon:  1.728, lat: 52.608, side: 'right', delay: 2 },
      { name: 'London',         lon: -0.118, lat: 51.509, side: 'right', delay: 3 },
    ];

    function adjustForUKAspect(geojson, centralLat) {
      const k = Math.cos((centralLat * Math.PI) / 180);
      function tx(coords) {
        if (typeof coords[0] === 'number') return [coords[0] * k, coords[1]];
        return coords.map(tx);
      }
      return {
        type: 'FeatureCollection',
        features: geojson.features.map((f) => ({
          type: 'Feature',
          properties: f.properties,
          geometry: { type: f.geometry.type, coordinates: tx(f.geometry.coordinates) },
        })),
      };
    }

    async function renderCoverMap() {
      const svgEl  = document.getElementById('cover-map-svg');
      const loadEl = document.getElementById('cover-map-loading');
      if (!svgEl || typeof d3 === 'undefined') return;

      let geo;
      try {
        geo = await d3.json(MAP_URL);
      } catch (err) {
        if (loadEl) loadEl.textContent = 'Map data unavailable';
        return;
      }
      const centralLat = 54.5;
      const k = Math.cos((centralLat * Math.PI) / 180);
      geo = adjustForUKAspect(geo, centralLat);

      const VW = 560, VH = 640;
      const projection = d3.geoIdentity().reflectY(true).fitExtent([[18, 18], [VW - 18, VH - 18]], geo);
      const pathGen = d3.geoPath(projection);

      const svg = d3.select(svgEl);
      svg.selectAll('*').remove();

      // ---- defs: gradients + filter ----
      const defs = svg.append('defs');
      const landGrad = defs.append('linearGradient')
        .attr('id', 'cover-land-gradient')
        .attr('x1', '0').attr('y1', '0').attr('x2', '0').attr('y2', '1');
      landGrad.append('stop').attr('offset', '0%').attr('stop-color', '#1d2a40');
      landGrad.append('stop').attr('offset', '100%').attr('stop-color', '#10182a');

      const floodGrad = defs.append('radialGradient').attr('id', 'cover-flood-grad');
      floodGrad.append('stop').attr('offset', '0%').attr('stop-color', 'rgba(124, 198, 255, 0.55)');
      floodGrad.append('stop').attr('offset', '100%').attr('stop-color', 'rgba(77, 171, 255, 0.0)');

      // Glow filter for flooded districts
      const glow = defs.append('filter').attr('id', 'cover-glow').attr('x', '-30%').attr('y', '-30%').attr('width', '160%').attr('height', '160%');
      glow.append('feGaussianBlur').attr('stdDeviation', '2.4').attr('result', 'b');
      const merge = glow.append('feMerge');
      merge.append('feMergeNode').attr('in', 'b');
      merge.append('feMergeNode').attr('in', 'SourceGraphic');

      // ---- Land layer ----
      const counts = geo.features.map(f => +f.properties[COUNT_FIELD] || 0);
      const maxCount = d3.max(counts) || 1;

      svg.append('g').attr('class', 'cover-map-land-layer')
        .selectAll('path').data(geo.features).enter()
        .append('path')
        .attr('class', 'cover-map-land')
        .attr('d', pathGen);

      // ---- Flood-glow layer (highlight all districts with any record) ----
      const floodLayer = svg.append('g').attr('class', 'cover-map-flood-layer').attr('filter', 'url(#cover-glow)');
      floodLayer.selectAll('path')
        .data(geo.features.filter(f => (+f.properties[COUNT_FIELD] || 0) > 0))
        .enter()
        .append('path')
        .attr('class', 'cover-map-flood')
        .attr('d', pathGen)
        .attr('fill', d => {
          const v = +d.properties[COUNT_FIELD] || 0;
          const t = Math.min(1, Math.pow(v / maxCount, 0.55));
          return `rgba(77, 171, 255, ${(t * 0.45).toFixed(3)})`;
        })
        .attr('stroke', d => {
          const v = +d.properties[COUNT_FIELD] || 0;
          const t = Math.min(1, Math.pow(v / maxCount, 0.55));
          return `rgba(124, 198, 255, ${(0.18 + t * 0.55).toFixed(3)})`;
        });

      // ---- Settlement light dots (sample feature centroids) ----
      const lightLayer = svg.append('g').attr('class', 'cover-map-lights');
      geo.features.forEach((f, i) => {
        if (i % 3 !== 0) return;          // sparse pattern
        const c = pathGen.centroid(f);
        if (!isFinite(c[0]) || !isFinite(c[1])) return;
        const v = +f.properties[COUNT_FIELD] || 0;
        const r = v > 0 ? 0.9 : 0.6;
        const op = v > 0 ? 0.85 : 0.45;
        lightLayer.append('circle')
          .attr('class', 'cover-map-light')
          .attr('cx', c[0]).attr('cy', c[1]).attr('r', r)
          .attr('opacity', op);
      });

      // ---- City markers w/ pill labels ----
      const cityLayer = svg.append('g').attr('class', 'cover-map-cities-layer');
      CITIES.forEach((city) => {
        const [px, py] = projection([city.lon * k, city.lat]);
        if (!isFinite(px) || !isFinite(py)) return;

        const g = cityLayer.append('g').attr('class', `cover-map-city-marker delay-${city.delay}`);

        // Pulse rings
        g.append('circle').attr('class', 'cover-map-city-pulse').attr('cx', px).attr('cy', py).attr('r', 6);

        // Core dot
        g.append('circle').attr('class', 'cover-map-city-dot').attr('cx', px).attr('cy', py).attr('r', 3.2);

        // Label pill (positioned to the right or left of the marker)
        const label = city.name;
        const padX = 7, padY = 4;
        // Approximate text width — 11px Inter ~ 6.4px/char
        const tw = label.length * 6.4 + padX * 2;
        const th = 18;
        const offsetX = 14;
        const pillX = city.side === 'right' ? px + offsetX : px - offsetX - tw;
        const pillY = py - th / 2;

        // Leader line
        g.append('line').attr('class', 'cover-map-city-leader')
          .attr('x1', px).attr('y1', py)
          .attr('x2', city.side === 'right' ? pillX : pillX + tw).attr('y2', py);

        const pill = g.append('g').attr('class', 'cover-map-city-pill');
        pill.append('rect')
          .attr('x', pillX).attr('y', pillY)
          .attr('width', tw).attr('height', th).attr('rx', 9);
        pill.append('text')
          .attr('x', pillX + padX).attr('y', pillY + th / 2 + 4)
          .text(label);
      });

      // Hide loader
      if (loadEl) {
        loadEl.classList.add('is-hidden');
        setTimeout(() => loadEl.remove(), 600);
      }
    }

    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', renderCoverMap);
    } else {
      renderCoverMap();
    }

    /* ============================================================
       CITY CAROUSEL — slide transitions + per-city dark map render
       ============================================================ */
    const CAROUSEL = document.getElementById('city-carousel');
    if (CAROUSEL) {
      const track = CAROUSEL.querySelector('.city-carousel-track');
      const slides = CAROUSEL.querySelectorAll('.city-slide');
      const dots = CAROUSEL.querySelectorAll('.city-carousel-dot');
      const prevBtn = CAROUSEL.querySelector('.city-carousel-nav.prev');
      const nextBtn = CAROUSEL.querySelector('.city-carousel-nav.next');
      const total = slides.length;
      let idx = 0;

      function go(i) {
        idx = (i + total) % total;
        track.style.transform = `translateX(-${idx * 100}%)`;
        dots.forEach((d, k) => d.classList.toggle('is-active', k === idx));
        CAROUSEL.dataset.active = String(idx);
      }

      prevBtn && prevBtn.addEventListener('click', () => go(idx - 1));
      nextBtn && nextBtn.addEventListener('click', () => go(idx + 1));
      dots.forEach(d => d.addEventListener('click', () => go(+d.dataset.index)));

      // Keyboard arrows when carousel has focus
      CAROUSEL.addEventListener('keydown', (e) => {
        if (e.key === 'ArrowLeft')  { e.preventDefault(); go(idx - 1); }
        if (e.key === 'ArrowRight') { e.preventDefault(); go(idx + 1); }
      });
      CAROUSEL.tabIndex = 0;
    }

    /* ---- Per-city mini dark map ---- */
    const CITY_MATCHERS = {
      Hull:           f => /Kingston upon Hull|Hull/i.test(f.properties[NAME_FIELD] || ''),
      York:           f => /^York$/i.test(f.properties[NAME_FIELD] || ''),
      GreatYarmouth:  f => /Great Yarmouth/i.test(f.properties[NAME_FIELD] || ''),
      // Greater London = bbox filter (lon -0.51..0.33, lat 51.28..51.69)
      London:         null,
    };
    const LONDON_BBOX = { lonMin: -0.51, lonMax: 0.33, latMin: 51.28, latMax: 51.69 };

    function bboxCentroid(coords) {
      // Find rough centroid via bbox of coordinates
      let xMin = Infinity, xMax = -Infinity, yMin = Infinity, yMax = -Infinity;
      function walk(c) {
        if (typeof c[0] === 'number') {
          if (c[0] < xMin) xMin = c[0];
          if (c[0] > xMax) xMax = c[0];
          if (c[1] < yMin) yMin = c[1];
          if (c[1] > yMax) yMax = c[1];
        } else { c.forEach(walk); }
      }
      walk(coords);
      return [(xMin + xMax) / 2, (yMin + yMax) / 2];
    }

    async function renderCitySlides() {
      const svgs = document.querySelectorAll('.city-slide-svg');
      if (!svgs.length || typeof d3 === 'undefined') return;

      let geo;
      try { geo = await d3.json(MAP_URL); }
      catch (_) { return; }

      const centralLat = 54.5;
      const k = Math.cos((centralLat * Math.PI) / 180);
      geo = adjustForUKAspect(geo, centralLat);

      svgs.forEach((svgEl) => {
        const cityKey = svgEl.dataset.citySvg;

        // Resolve subset of features for this city
        let subset;
        if (cityKey === 'London') {
          // Pre-adjusted lon, so multiply bbox lons by k
          subset = geo.features.filter((f) => {
            const c = bboxCentroid(f.geometry.coordinates);
            const lonAdj = c[0]; // already scaled
            const lat = c[1];
            return lonAdj >= LONDON_BBOX.lonMin * k && lonAdj <= LONDON_BBOX.lonMax * k &&
                   lat    >= LONDON_BBOX.latMin     && lat    <= LONDON_BBOX.latMax;
          });
        } else {
          const matcher = CITY_MATCHERS[cityKey];
          subset = matcher ? geo.features.filter(matcher) : [];
        }
        if (!subset.length) return;

        // Build a FeatureCollection of just this subset for fitExtent
        const subsetFC = { type: 'FeatureCollection', features: subset };

        // Pad: include neighbouring features for visual context (within bbox + buffer)
        const subsetBBox = (() => {
          let xMin = Infinity, xMax = -Infinity, yMin = Infinity, yMax = -Infinity;
          subset.forEach((f) => {
            const c = bboxCentroid(f.geometry.coordinates);
            // use full bbox of the feature
            (function walk(coords) {
              if (typeof coords[0] === 'number') {
                if (coords[0] < xMin) xMin = coords[0];
                if (coords[0] > xMax) xMax = coords[0];
                if (coords[1] < yMin) yMin = coords[1];
                if (coords[1] > yMax) yMax = coords[1];
              } else { coords.forEach(walk); }
            })(f.geometry.coordinates);
          });
          const padX = (xMax - xMin) * 0.55 || 0.4;
          const padY = (yMax - yMin) * 0.55 || 0.4;
          return [xMin - padX, yMin - padY, xMax + padX, yMax + padY];
        })();

        const contextFeatures = geo.features.filter((f) => {
          const c = bboxCentroid(f.geometry.coordinates);
          return c[0] >= subsetBBox[0] && c[0] <= subsetBBox[2] &&
                 c[1] >= subsetBBox[1] && c[1] <= subsetBBox[3];
        });

        const VW = 480, VH = 280;
        const projection = d3.geoIdentity().reflectY(true)
          .fitExtent([[16, 16], [VW - 16, VH - 16]], subsetFC);
        const pathGen = d3.geoPath(projection);

        const svg = d3.select(svgEl);
        svg.selectAll('*').remove();

        // Context (neighbour) layer — dim
        svg.append('g').selectAll('path')
          .data(contextFeatures)
          .enter().append('path')
          .attr('class', 'city-la')
          .attr('d', pathGen);

        // Target (subset) layer — highlighted
        svg.append('g').selectAll('path')
          .data(subset)
          .enter().append('path')
          .attr('class', 'city-la is-target')
          .attr('d', pathGen);

        // Flood glow — features in subset that have polygon_count > 0
        svg.append('g').selectAll('path')
          .data(subset.filter(f => (+f.properties[COUNT_FIELD] || 0) > 0))
          .enter().append('path')
          .attr('class', 'city-flood')
          .attr('d', pathGen)
          .attr('fill', d => {
            const v = +d.properties[COUNT_FIELD] || 0;
            const t = Math.min(1, Math.pow(v / 200, 0.55));
            return `rgba(77, 171, 255, ${(t * 0.45).toFixed(3)})`;
          });

        // City center marker (computed from subset bbox, not centroid of geometry)
        const subsetBBoxTight = (() => {
          let xMin = Infinity, xMax = -Infinity, yMin = Infinity, yMax = -Infinity;
          subset.forEach((f) => {
            (function walk(coords) {
              if (typeof coords[0] === 'number') {
                if (coords[0] < xMin) xMin = coords[0];
                if (coords[0] > xMax) xMax = coords[0];
                if (coords[1] < yMin) yMin = coords[1];
                if (coords[1] > yMax) yMax = coords[1];
              } else { coords.forEach(walk); }
            })(f.geometry.coordinates);
          });
          return [(xMin + xMax) / 2, (yMin + yMax) / 2];
        })();
        const [mx, my] = projection(subsetBBoxTight);
        if (isFinite(mx) && isFinite(my)) {
          const mg = svg.append('g').attr('class', 'city-marker');
          mg.append('circle').attr('class', 'city-marker-pulse').attr('cx', mx).attr('cy', my).attr('r', 8);
          mg.append('circle').attr('class', 'city-marker-core').attr('cx', mx).attr('cy', my).attr('r', 3.6);
        }
      });
    }

    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', renderCitySlides);
    } else {
      renderCitySlides();
    }
  })();

/* ============================================================
     STANDALONE PRICE TREND CHART
     Data: ../CASA0029_project/data/flood_price_compare_precomputed.json
     ============================================================ */
  (function () {
    const ZONE_CFG = [
      { key: 'FZ3',      color: '#ef4444', label: 'Zone 3' },
      { key: 'FZ2',      color: '#f59e0b', label: 'Zone 2' },
      { key: 'no_flood', color: '#3b82f6', label: 'No flood' },
    ];

    const DATA_URLS = [
      '../CASA0029_project/data/price_trend_by_zone.json',
      'https://raw.githubusercontent.com/Levine-l/CASA0029_project/main/data/price_trend_by_zone.json',
    ];

    let trendData = null;
    let activeTrendKey = 'london';

    async function loadTrendData() {
      for (const url of DATA_URLS) {
        try {
          const r = await fetch(url);
          if (!r.ok) continue;
          trendData = await r.json();
          return;
        } catch (e) { /* try next */ }
      }
    }

    function drawTrend(trendKey) {
      const titleEl    = document.getElementById('outer-trend-title');
      const subtitleEl = document.getElementById('outer-trend-subtitle');
      const emptyEl    = document.getElementById('outer-trend-empty');
      const wrapEl     = document.getElementById('outer-canvas-wrap');
      const canvas     = document.getElementById('outer-trend-canvas');
      const btnEl      = document.querySelector(
        '.outer-city-btn[data-trend-key="' + trendKey + '"]');
      const cityLabel  = btnEl ? btnEl.dataset.cityLabel : trendKey;

      titleEl.textContent    = cityLabel + ' · Price / m² Trend';
      subtitleEl.textContent = cityLabel + ' · Median GBP/m² by flood zone';

      const cityData = trendData && trendData.cities && trendData.cities[trendKey];
      if (!cityData) {
        canvas.style.display = 'none';
        emptyEl.style.display = '';
        emptyEl.textContent = trendData ? 'No data for this city.' : 'Data failed to load.';
        return;
      }
      canvas.style.display = '';
      emptyEl.style.display = 'none';
      _drawCanvas(canvas, wrapEl, cityData);
    }

    function _drawCanvas(canvas, wrap, cityData) {
      const dpr  = Math.min(window.devicePixelRatio || 1, 2);
      const cssW = wrap.clientWidth || 700;
      const cssH = 240;
      canvas.width  = cssW * dpr;
      canvas.height = cssH * dpr;
      canvas.style.width  = cssW + 'px';
      canvas.style.height = cssH + 'px';

      const ctx = canvas.getContext('2d');
      ctx.scale(dpr, dpr);
      ctx.clearRect(0, 0, cssW, cssH);

      const P = { top: 14, right: 12, bottom: 30, left: 52 };
      const cW = cssW - P.left - P.right;
      const cH = cssH - P.top  - P.bottom;
      const years = cityData.years;

      const allVals = [];
      for (const zc of ZONE_CFG) {
        (cityData[zc.key] || []).forEach(v => { if (v != null) allVals.push(v); });
      }
      if (!allVals.length) return;

      const rawMin = Math.min(...allVals);
      const rawMax = Math.max(...allVals);
      const vpad   = (rawMax - rawMin) * 0.12 || rawMax * 0.1;
      const yMin   = Math.max(0, rawMin - vpad);
      const yMax   = rawMax + vpad;
      const xMin   = years[0];
      const xMax   = years[years.length - 1];

      function xp(yr)  { return P.left + (yr - xMin) / (xMax - xMin) * cW; }
      function yp(val) { return P.top  + (1 - (val - yMin) / (yMax - yMin)) * cH; }

      // Y gridlines + labels
      for (let i = 0; i <= 5; i++) {
        const v = yMin + (yMax - yMin) * i / 5;
        const y = yp(v);
        ctx.strokeStyle = 'rgba(107,154,196,0.15)';
        ctx.lineWidth = 0.8;
        ctx.beginPath(); ctx.moveTo(P.left, y); ctx.lineTo(P.left + cW, y); ctx.stroke();
        ctx.fillStyle = '#5b6b82';
        ctx.font = '11px Inter,system-ui,sans-serif';
        ctx.textAlign = 'right';
        const lbl = v >= 1000 ? (v / 1000).toFixed(v >= 10000 ? 0 : 1) + 'k' : Math.round(v).toString();
        ctx.fillText(lbl, P.left - 6, y + 4);
      }

      // X baseline
      ctx.strokeStyle = 'rgba(107,154,196,0.25)';
      ctx.lineWidth = 0.8;
      ctx.beginPath(); ctx.moveTo(P.left, P.top + cH); ctx.lineTo(P.left + cW, P.top + cH); ctx.stroke();

      // X labels
      const step = years.length > 14 ? 4 : years.length > 8 ? 3 : 2;
      ctx.fillStyle = '#5b6b82';
      ctx.font = '11px Inter,system-ui,sans-serif';
      ctx.textAlign = 'center';
      years.forEach((yr, i) => {
        if (i % step !== 0 && i !== years.length - 1) return;
        ctx.fillText(String(yr), xp(yr), P.top + cH + 20);
      });

      // Zone lines + dots
      for (const zc of ZONE_CFG) {
        const vals = cityData[zc.key];
        if (!vals) continue;
        ctx.strokeStyle = zc.color;
        ctx.lineWidth = 2.2;
        ctx.lineJoin = 'round';
        ctx.lineCap  = 'round';
        ctx.globalAlpha = 0.92;
        ctx.beginPath();
        let started = false;
        years.forEach((yr, i) => {
          const v = vals[i];
          if (v == null) { started = false; return; }
          if (!started) { ctx.moveTo(xp(yr), yp(v)); started = true; }
          else ctx.lineTo(xp(yr), yp(v));
        });
        ctx.stroke();
        ctx.fillStyle = zc.color;
        ctx.globalAlpha = 0.75;
        years.forEach((yr, i) => {
          const v = vals[i];
          if (v == null) return;
          ctx.beginPath();
          ctx.arc(xp(yr), yp(v), 2.5, 0, Math.PI * 2);
          ctx.fill();
        });
      }
      ctx.globalAlpha = 1;

      canvas._outerMeta = { years, cityData, xMin, xMax, yMin, yMax, P, cW, cH };
    }

    function initTooltip() {
      const canvas = document.getElementById('outer-trend-canvas');
      const vline  = document.getElementById('outer-vline');
      const tt     = document.getElementById('outer-tt');
      const wrap   = document.getElementById('outer-canvas-wrap');

      canvas.addEventListener('mousemove', e => {
        const m = canvas._outerMeta;
        if (!m) return;
        const rect = canvas.getBoundingClientRect();
        const mx = e.clientX - rect.left;
        const { years, cityData, xMin, xMax, P, cW } = m;
        if (mx < P.left || mx > P.left + cW) {
          vline.style.display = 'none'; tt.style.display = 'none'; return;
        }
        const frac = (mx - P.left) / cW;
        const idx  = Math.min(years.length - 1, Math.max(0, Math.round(frac * (years.length - 1))));
        const yr   = years[idx];
        const xPx  = P.left + (yr - xMin) / (xMax - xMin) * cW;

        vline.style.left    = xPx + 'px';
        vline.style.display = 'block';

        let html = '<span style="font-weight:700;color:#f1f5f9">' + yr + '</span>';
        for (const zc of ZONE_CFG) {
          const v = cityData[zc.key] && cityData[zc.key][idx];
          if (v == null) continue;
          html += '<br><span style="color:' + zc.color + '">' + zc.label + '</span>: £' + Math.round(v).toLocaleString('en-GB') + '/m²';
        }
        tt.innerHTML    = html;
        tt.style.display = 'block';
        const wrapW = wrap.clientWidth;
        const ttW   = tt.offsetWidth || 130;
        tt.style.left = (xPx + 10 + ttW > wrapW ? xPx - ttW - 10 : xPx + 10) + 'px';
        tt.style.top  = '6px';
      });
      canvas.addEventListener('mouseleave', () => {
        vline.style.display = 'none'; tt.style.display = 'none';
      });
    }

    (async () => {
      // City tab click handlers (manual)
      document.getElementById('outer-city-tabs').addEventListener('click', e => {
        const btn = e.target.closest('.outer-city-btn');
        if (!btn) return;
        document.querySelectorAll('.outer-city-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        activeTrendKey = btn.dataset.trendKey;
        drawTrend(activeTrendKey);
      });

      // Sync with iframe navigate buttons via postMessage
      window.addEventListener('message', e => {
        if (!e.data || e.data.type !== 'cityChange') return;
        const key = e.data.trendKey;
        const btn = document.querySelector('.outer-city-btn[data-trend-key="' + key + '"]');
        if (!btn) return;
        document.querySelectorAll('.outer-city-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        activeTrendKey = key;
        if (trendData) drawTrend(activeTrendKey);
      });

      // Redraw on window resize
      window.addEventListener('resize', () => {
        if (trendData) drawTrend(activeTrendKey);
      });

      initTooltip();

      await loadTrendData();
      drawTrend(activeTrendKey);
    })();
  })();
