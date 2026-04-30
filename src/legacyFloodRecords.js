(() => {
  const d3 = window.d3;
  const CSV_PATH = "data/four_city_events.csv";

  const CITY_ORDER = ["Hull", "York", "GreatYarmouth", "London"];
  const CITY_DISPLAY = {
    Hull: "Hull",
    York: "York",
    GreatYarmouth: "Great Yarmouth",
    London: "Greater London",
  };

  const SEASON_COLOUR = {
    Spring: "#97d8c4",
    Summer: "#f4b942",
    Autumn: "#F2BEFC",
    Winter: "#4059ad",
    Unknown: "#999999",
  };
  const SEASON_ORDER = ["Spring", "Summer", "Autumn", "Winter", "Unknown"];

  const MAP_GEOJSON = "data/uk_flood_frequency_simplified.geojson";
  const MAP_NAME_FIELD = "LAD25NM";
  const MAP_COUNT_FIELD = "polygon_count";

  const tooltip = document.getElementById("tooltip");
  const errorBanner = document.getElementById("error-banner");

  // Kick off the choropleth map (independent of the temporal charts).
  initHeroMap();

  // Section 03 — city tab interactions (placeholder for now).
  initHousingCityTabs();

  d3.csv(CSV_PATH, rowParser)
    .then((rows) => {
      const cleaned = rows.filter((d) => d && Number.isFinite(d.fxg_year));
      const grouped = buildCityYearData(cleaned);
      renderLegends(cleaned);
      renderAllPanels(grouped);
      window.addEventListener("resize", debounce(() => renderAllPanels(grouped), 120));
    })
    .catch((err) => {
      console.error("Failed to load flood dataset:", err);
      errorBanner.hidden = false;
    });

  function rowParser(row) {
    const year = +row.fxg_year;
    const month = +row.fxg_month;
    if (!Number.isFinite(year) || year <= 0) return null;

    const rawSeason = (row.fxg_season || "").trim();
    const season = SEASON_ORDER.includes(rawSeason) ? rawSeason : "Unknown";

    return {
      rec_grp_id: row.rec_grp_id,
      city: row.city,
      fxg_year: year,
      fxg_month: Number.isFinite(month) ? month : null,
      fxg_season: season,
      fxg_name: row.fxg_name || "",
      fxg_start_date: row.fxg_start_date || "",
      fxg_end_date: row.fxg_end_date || "",
      fxg_flood_src: (row.fxg_flood_src || "").trim() || "Unknown",
      fxg_flood_caus: (row.fxg_flood_caus || "").trim() || "Unknown",
    };
  }

  function buildCityYearData(rows) {
    const out = {};
    for (const city of CITY_ORDER) out[city] = [];

    const byCity = d3.group(rows, (d) => d.city);

    for (const city of CITY_ORDER) {
      const cityRows = byCity.get(city) || [];

      const uniqueById = Array.from(
        d3.group(cityRows, (d) => d.rec_grp_id),
        ([id, items]) => items[0]
      );

      const byYear = d3.group(uniqueById, (d) => d.fxg_year);

      const yearEntries = Array.from(byYear, ([year, events]) => {
        const seasonCounts = {};
        for (const s of SEASON_ORDER) seasonCounts[s] = 0;
        for (const e of events) seasonCounts[e.fxg_season] += 1;

        const dominantSeason = Object.entries(seasonCounts).sort(
          (a, b) => b[1] - a[1] || SEASON_ORDER.indexOf(a[0]) - SEASON_ORDER.indexOf(b[0])
        )[0][0];

        return {
          city,
          year,
          event_count: events.length,
          dominant_season: dominantSeason,
          seasonCounts,
          events,
        };
      }).sort((a, b) => a.year - b.year);

      out[city] = yearEntries;
    }

    return out;
  }

  function renderLegends(allRows) {
    const seasonLegend = document.getElementById("season-legend");
    seasonLegend.innerHTML = "";
    for (const season of SEASON_ORDER) {
      const chip = document.createElement("span");
      chip.className = "legend-chip";
      chip.innerHTML = `<span class="legend-swatch" style="background:${SEASON_COLOUR[season]}"></span>${season}`;
      seasonLegend.appendChild(chip);
    }

    const totals = document.getElementById("totals-legend");
    totals.innerHTML = "";
    for (const city of CITY_ORDER) {
      const cityRows = allRows.filter((d) => d.city === city);
      const uniqueCount = new Set(cityRows.map((d) => d.rec_grp_id)).size;
      const chip = document.createElement("span");
      chip.className = "legend-chip";
      chip.innerHTML = `<strong>${CITY_DISPLAY[city]}</strong><span class="count">${uniqueCount}</span>`;
      totals.appendChild(chip);
    }
  }

  function renderAllPanels(grouped) {
    const grid = d3.select("#chart-grid");
    grid.selectAll(".panel").remove();

    const maxCount = d3.max(Object.values(grouped).flat(), (d) => d.event_count) || 1;

    for (const city of CITY_ORDER) {
      const panel = grid.append("div").attr("class", "panel");
      const cityData = grouped[city];
      const total = d3.sum(cityData, (d) => d.event_count);

      const years = cityData.map((d) => d.year);
      const xDomain = years.length ? [d3.min(years) - 1, d3.max(years) + 1] : [2000, 2020];

      panel.append("div").attr("class", "panel-header").html(`
        <h2 class="panel-title">${CITY_DISPLAY[city]}</h2>
        <span class="panel-meta"><span class="meta-value">${total}</span> events</span>
      `);

      const seasonsPresent = SEASON_ORDER.filter((s) =>
        cityData.some((d) => d.dominant_season === s)
      );
      const legendRow = panel
        .append("div")
        .attr("class", "panel-legend")
        .attr("aria-label", "Seasons shown in this chart");
      for (const season of seasonsPresent) {
        const chip = legendRow.append("span").attr("class", "panel-legend-chip");
        chip
          .append("span")
          .attr("class", "panel-legend-swatch")
          .style("background", SEASON_COLOUR[season]);
        chip.append("span").text(season);
      }

      drawPanelChart(panel.node(), cityData, { xDomain, maxCount });
    }
  }

  function drawPanelChart(container, data, { xDomain, maxCount }) {
    const width = container.clientWidth || 520;
    const height = Math.max(240, Math.min(320, Math.round(width * 0.58)));
    const margin = { top: 16, right: 20, bottom: 42, left: 48 };
    const innerW = width - margin.left - margin.right;
    const innerH = height - margin.top - margin.bottom;

    const svg = d3
      .select(container)
      .append("svg")
      .attr("viewBox", `0 0 ${width} ${height}`)
      .attr("preserveAspectRatio", "xMidYMid meet");

    const g = svg
      .append("g")
      .attr("transform", `translate(${margin.left},${margin.top})`);

    const x = d3.scaleLinear().domain(xDomain).nice().range([0, innerW]);
    const y = d3
      .scaleLinear()
      .domain([0, Math.max(1, maxCount)])
      .nice()
      .range([innerH, 0]);

    g.append("g")
      .attr("class", "gridline")
      .call(
        d3
          .axisLeft(y)
          .tickSize(-innerW)
          .tickFormat("")
          .ticks(Math.min(6, y.domain()[1]))
      );

    const xAxis = d3
      .axisBottom(x)
      .ticks(Math.min(8, Math.floor(innerW / 70)))
      .tickFormat(d3.format("d"));
    g.append("g")
      .attr("class", "axis")
      .attr("transform", `translate(0,${innerH})`)
      .call(xAxis);

    const yAxis = d3
      .axisLeft(y)
      .ticks(Math.min(6, y.domain()[1]))
      .tickFormat(d3.format("d"));
    g.append("g").attr("class", "axis").call(yAxis);

    g.append("text")
      .attr("class", "axis-title")
      .attr("x", innerW / 2)
      .attr("y", innerH + 34)
      .attr("text-anchor", "middle")
      .text("Year");

    g.append("text")
      .attr("class", "axis-title")
      .attr("transform", `rotate(-90)`)
      .attr("x", -innerH / 2)
      .attr("y", -34)
      .attr("text-anchor", "middle")
      .text("Annual Event Count");

    if (!data.length) {
      g.append("text")
        .attr("x", innerW / 2)
        .attr("y", innerH / 2)
        .attr("text-anchor", "middle")
        .attr("fill", "var(--text-muted)")
        .attr("font-size", 13)
        .text("No recorded events");
      return;
    }

    const yearSpan = Math.max(1, xDomain[1] - xDomain[0]);
    const barWidth = Math.max(2, Math.min(14, (innerW / yearSpan) * 0.82));
    const hoverWidth = Math.max(barWidth, 14);

    const segments = [];
    for (const yearData of data) {
      let y0 = 0;
      for (const season of SEASON_ORDER) {
        const count = yearData.seasonCounts[season] || 0;
        if (count > 0) {
          segments.push({ yearData, season, y0, y1: y0 + count });
          y0 += count;
        }
      }
    }

    const segmentSel = g
      .selectAll("rect.segment")
      .data(segments)
      .enter()
      .append("rect")
      .attr("class", "segment")
      .attr("x", (d) => x(d.yearData.year) - barWidth / 2)
      .attr("width", barWidth)
      .attr("y", innerH)
      .attr("height", 0)
      .attr("fill", (d) => SEASON_COLOUR[d.season])
      .attr("rx", 1.5);

    segmentSel
      .transition()
      .delay((_, i) => 80 + i * 10)
      .duration(500)
      .ease(d3.easeCubicOut)
      .attr("y", (d) => y(d.y1))
      .attr("height", (d) => Math.max(1, y(d.y0) - y(d.y1)));

    const activate = (yearData) =>
      g
        .selectAll("rect.segment")
        .classed("is-active", (s) => s.yearData === yearData);
    const deactivate = () => g.selectAll("rect.segment").classed("is-active", false);

    g.selectAll("rect.year-hit")
      .data(data)
      .enter()
      .append("rect")
      .attr("class", "year-hit")
      .attr("x", (d) => x(d.year) - hoverWidth / 2)
      .attr("y", 0)
      .attr("width", hoverWidth)
      .attr("height", innerH)
      .attr("fill", "transparent")
      .style("pointer-events", "all")
      .on("mouseenter", function (event, d) {
        activate(d);
        showTooltip(event, d);
      })
      .on("mousemove", (event) => positionTooltip(event))
      .on("mouseleave", function () {
        deactivate();
        hideTooltip();
      });
  }

  function showTooltip(event, d) {
    const srcs = uniqueList(d.events.map((e) => e.fxg_flood_src));
    const causes = uniqueList(d.events.map((e) => e.fxg_flood_caus));
    const dateRange = summariseDates(d.events);

    const breakdown = SEASON_ORDER
      .filter((s) => (d.seasonCounts[s] || 0) > 0)
      .map(
        (s) =>
          `<span class="tt-chip"><span class="tt-chip-dot" style="background:${SEASON_COLOUR[s]}"></span>${s} · ${d.seasonCounts[s]}</span>`
      )
      .join(" ");

    tooltip.innerHTML = `
      <div class="tt-header">
        <span class="tt-swatch" style="background:${SEASON_COLOUR[d.dominant_season]}"></span>
        ${CITY_DISPLAY[d.city]} · ${d.year}
      </div>
      <div class="tt-row"><span class="tt-label">Events</span><span class="tt-value accent">${d.event_count}</span></div>
      <div class="tt-row"><span class="tt-label">By season</span><span class="tt-value">${breakdown}</span></div>
      <div class="tt-row"><span class="tt-label">Source(s)</span><span class="tt-value">${srcs}</span></div>
      <div class="tt-row"><span class="tt-label">Cause(s)</span><span class="tt-value">${causes}</span></div>
      ${dateRange ? `<div class="tt-row"><span class="tt-label">Dates</span><span class="tt-value"><span class="nowrap">${dateRange}</span></span></div>` : ""}
    `;
    tooltip.classList.add("visible");
    tooltip.setAttribute("aria-hidden", "false");
    positionTooltip(event);
  }

  function positionTooltip(event) {
    const pad = 14;
    const rect = tooltip.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    let left = event.clientX + pad;
    let top = event.clientY + pad;
    if (left + rect.width + pad > vw) left = event.clientX - rect.width - pad;
    if (top + rect.height + pad > vh) top = event.clientY - rect.height - pad;
    tooltip.style.left = `${Math.max(8, left)}px`;
    tooltip.style.top = `${Math.max(8, top)}px`;
  }

  function hideTooltip() {
    tooltip.classList.remove("visible", "is-map");
    tooltip.setAttribute("aria-hidden", "true");
  }

  function uniqueList(arr) {
    const clean = arr
      .map((s) => (s || "").trim())
      .filter((s) => s && s.toLowerCase() !== "unknown");
    if (!clean.length) return "Unknown";
    return Array.from(new Set(clean)).join(", ");
  }

  function summariseDates(events) {
    const starts = events.map((e) => e.fxg_start_date).filter(Boolean).sort();
    const ends = events.map((e) => e.fxg_end_date).filter(Boolean).sort();
    if (!starts.length && !ends.length) return "";
    const first = starts[0] ? starts[0].slice(0, 10) : "—";
    const last = ends.length ? ends[ends.length - 1].slice(0, 10) : "—";
    return `${first} → ${last}`;
  }

  function debounce(fn, wait) {
    let t;
    return (...args) => {
      clearTimeout(t);
      t = setTimeout(() => fn(...args), wait);
    };
  }

  /* ----------------------------------------------------
     HERO CHOROPLETH MAP
     ---------------------------------------------------- */

  async function initHeroMap() {
    const container = document.getElementById("map-container");
    const loading = document.getElementById("map-loading");
    if (!container) return;

    let geo;
    try {
      geo = await d3.json(MAP_GEOJSON);
    } catch (err) {
      console.error("Failed to load UK flood frequency map:", err);
      if (loading) loading.textContent = "Map data unavailable";
      return;
    }

    // Pre-correct longitudes by cos(central UK latitude) so the flat
    // identity projection renders the UK with realistic proportions
    // (counters lon-degree distortion at ~55°N).
    geo = adjustForUKAspect(geo, 54.5);

    const counts = geo.features.map(
      (f) => +f.properties[MAP_COUNT_FIELD] || 0
    );
    const nonZero = counts.filter((c) => c > 0).sort(d3.ascending);
    const maxCount = d3.max(counts) || 1;

    // 7-class quantile scale on non-zero values → highlights the skew.
    const palette = d3.schemeBlues[7];
    const quantiles = [];
    for (let i = 1; i < 7; i++) {
      quantiles.push(d3.quantileSorted(nonZero, i / 7));
    }
    const classify = (value) => {
      if (!value || value <= 0) return 0;
      for (let i = 0; i < quantiles.length; i++) {
        if (value <= quantiles[i]) return i + 1;
      }
      return 6;
    };
    const fillFor = (value) =>
      value == null || value <= 0 ? "#e6ecef" : palette[classify(value)];

    const svg = d3
      .select(container)
      .append("svg")
      .attr("role", "img")
      .attr("aria-label", "UK choropleth of recorded flood outlines by local authority");

    const viewGroup = svg.append("g").attr("class", "map-view");
    const pathsGroup = viewGroup.append("g").attr("class", "map-paths");

    const pathGen = d3.geoPath();
    let projection;
    let currentDims = { width: 0, height: 0 };

    // Lat ceiling for "England-focused" framing — excludes Scottish highlands
    // / Northern Isles from the fit bounds so the initial view centres on
    // England + Wales + the immediate Scottish border. Features above this
    // are still drawn (they just fall outside the viewport and are clipped).
    const FIT_LAT_MAX = 55.9;
    function featureLatBBox(f) {
      let yMin = Infinity, yMax = -Infinity;
      (function walk(coords) {
        if (typeof coords[0] === "number") {
          if (coords[1] < yMin) yMin = coords[1];
          if (coords[1] > yMax) yMax = coords[1];
        } else coords.forEach(walk);
      })(f.geometry.coordinates);
      return { yMin, yMax };
    }
    const fitFeatures = geo.features.filter((f) => {
      const { yMin, yMax } = featureLatBBox(f);
      // Centroid latitude below the ceiling — keeps England + Wales + a
      // touch of southern Scotland.
      return (yMin + yMax) / 2 <= FIT_LAT_MAX;
    });
    const fitTarget = fitFeatures.length
      ? { type: "FeatureCollection", features: fitFeatures }
      : geo;

    // ---- Centring knobs ----
    // PAD_*: padding inside the container on each edge (px).
    //   Increase one side to push the map AWAY from that edge.
    // OFFSET_X / OFFSET_Y: extra translation applied AFTER fitExtent (px).
    //   Positive X moves the map right; positive Y moves it down.
    const PAD_TOP = 200;
    const PAD_RIGHT = 60;
    const PAD_BOTTOM = 1;
    const PAD_LEFT = 1;
    const OFFSET_X = -20;
    const OFFSET_Y = 20;

    function sizeAndProject() {
      const rect = container.getBoundingClientRect();
      const width = Math.max(200, rect.width);
      const height = Math.max(200, rect.height);
      currentDims = { width, height };

      svg.attr("viewBox", `0 0 ${width} ${height}`);

      // Use geoIdentity for UK-scale data — avoids the spherical-clip
      // artifacts that geoMercator adds around each feature. Fit to the
      // England-focused subset, then nudge with OFFSET_X/Y so the visible
      // map (England + Wales) sits dead-centre in the frame.
      projection = d3.geoIdentity().reflectY(true)
        .fitExtent(
          [[PAD_LEFT, PAD_TOP], [width - PAD_RIGHT, height - PAD_BOTTOM]],
          fitTarget
        );
      const [tx, ty] = projection.translate();
      projection.translate([tx + OFFSET_X, ty + OFFSET_Y]);
      pathGen.projection(projection);

      pathsGroup.selectAll("path.la-path").attr("d", pathGen);
    }

    // Initial paths
    pathsGroup
      .selectAll("path.la-path")
      .data(geo.features, (d) => d.properties[MAP_NAME_FIELD])
      .enter()
      .append("path")
      .attr("class", "la-path")
      .attr("fill", (d) => fillFor(+d.properties[MAP_COUNT_FIELD]))
      .on("mouseenter", function (event, d) {
        d3.select(this).raise().classed("is-active", true);
        showMapTooltip(event, d);
      })
      .on("mousemove", (event) => positionTooltip(event))
      .on("mouseleave", function () {
        d3.select(this).classed("is-active", false);
        hideTooltip();
      })
      .on("click", function (event, d) {
        event.stopPropagation();
        zoomToFeature(d);
      });

    sizeAndProject();

    // Zoom behaviour
    const zoom = d3
      .zoom()
      .scaleExtent([1, 15])
      .on("zoom", (event) => {
        viewGroup.attr("transform", event.transform);
        pathsGroup.selectAll("path.la-path").attr("stroke-width", 0.35 / event.transform.k);
      });

    svg.call(zoom);
    svg.on("dblclick.zoom", null); // disable d3-zoom's default dblclick-zoom

    function zoomToFeature(feature) {
      const [[x0, y0], [x1, y1]] = pathGen.bounds(feature);
      const dx = x1 - x0;
      const dy = y1 - y0;
      const { width, height } = currentDims;
      const scale = Math.min(
        12,
        5 / Math.max(dx / width, dy / height)
      );
      const tx = (width - scale * (x0 + x1)) / 2;
      const ty = (height - scale * (y0 + y1)) / 2;
      svg
        .transition()
        .duration(750)
        .ease(d3.easeCubicInOut)
        .call(
          zoom.transform,
          d3.zoomIdentity.translate(tx, ty).scale(scale)
        );
    }

    svg.on("dblclick", (event) => {
      // Only reset when double-click lands on empty background (no LA path).
      if (event.target && event.target.classList.contains("la-path")) return;
      svg
        .transition()
        .duration(600)
        .ease(d3.easeCubicInOut)
        .call(zoom.transform, d3.zoomIdentity);
    });

    // Legend
    renderMapLegend(quantiles, palette, maxCount);

    // Responsive re-projection
    const onResize = debounce(() => {
  const d3 = window.d3;
      sizeAndProject();
      svg.call(zoom.transform, d3.zoomIdentity);
    }, 150);
    window.addEventListener("resize", onResize);

    // Hide loading overlay
    if (loading) {
      requestAnimationFrame(() => loading.classList.add("is-hidden"));
      setTimeout(() => loading.remove(), 700);
    }
  }

  function renderMapLegend(quantiles, palette, maxCount) {
    const legend = d3.select("#map-legend");
    if (legend.empty()) return;
    legend.selectAll("*").remove();

    legend
      .append("span")
      .attr("class", "legend-title")
      .text("Number of Recorded Flood Outlines");

    // "No record" swatch
    const zeroItem = legend.append("span").attr("class", "legend-bucket");
    zeroItem
      .append("span")
      .attr("class", "legend-bucket-swatch")
      .style("background", "#e6ecef");
    zeroItem.append("span").text("0");

    const edges = [0, ...quantiles.map((q) => Math.round(q)), Math.round(maxCount)];
    for (let i = 1; i < edges.length; i++) {
      const lo = edges[i - 1] + (i === 1 ? 1 : 1);
      const hi = edges[i];
      const label = lo >= hi ? `${hi}` : `${lo}–${hi}`;
      const item = legend.append("span").attr("class", "legend-bucket");
      item
        .append("span")
        .attr("class", "legend-bucket-swatch")
        .style("background", palette[i - 1]);
      item.append("span").text(label);
    }
  }

  function showMapTooltip(event, feature) {
    const name = feature.properties[MAP_NAME_FIELD] || "Unknown";
    const count = +feature.properties[MAP_COUNT_FIELD] || 0;
    tooltip.innerHTML = `
      <div class="tt-header">${name}</div>
      <div class="tt-map-stat">
        <span class="tt-map-label">Recorded flood outlines</span>
        <span class="tt-map-value">${count.toLocaleString()}</span>
      </div>
    `;
    tooltip.classList.add("visible", "is-map");
    tooltip.setAttribute("aria-hidden", "false");
    positionTooltip(event);
  }

  /* ----------------------------------------------------
     SECTION 03 — CITY TABS
     ---------------------------------------------------- */

  function initHousingCityTabs() {
    const tabs = document.querySelectorAll(".city-tab");
    if (!tabs.length) return;
    const selectedLabel = document.getElementById("housing-selected-city");
    tabs.forEach((tab) => {
      tab.addEventListener("click", () => {
        tabs.forEach((t) => {
          t.classList.remove("is-active");
          t.setAttribute("aria-selected", "false");
        });
        tab.classList.add("is-active");
        tab.setAttribute("aria-selected", "true");
        if (selectedLabel) {
          selectedLabel.textContent = tab.dataset.city || "";
        }
      });
    });
  }

  /* ----------------------------------------------------
     HERO LEFT — EVENT HISTORY BROWSER
     ---------------------------------------------------- */

  function renderEventHistory(rows) {
    const list = document.getElementById("event-history-list");
    if (!list) return;

    // De-duplicate by rec_grp_id and sort most-recent-first.
    const seen = new Set();
    const sorted = rows
      .slice()
      .sort((a, b) => {
        const da = a.fxg_start_date || "";
        const db = b.fxg_start_date || "";
        if (db !== da) return db.localeCompare(da);
        return (b.fxg_year || 0) - (a.fxg_year || 0);
      });

    const unique = [];
    for (const r of sorted) {
      if (!r.rec_grp_id || seen.has(r.rec_grp_id)) continue;
      seen.add(r.rec_grp_id);
      unique.push(r);
    }

    if (!unique.length) {
      list.innerHTML = `<li class="history-item history-item-empty">No events to display.</li>`;
      return;
    }

    list.innerHTML = unique
      .map((r) => {
        const cityName = CITY_DISPLAY[r.city] || r.city || "";
        const season = r.fxg_season || "Unknown";
        const seasonColor = SEASON_COLOUR[season] || SEASON_COLOUR.Unknown;
        const src =
          r.fxg_flood_src && r.fxg_flood_src.toLowerCase() !== "unknown"
            ? r.fxg_flood_src
            : "";
        const meta = [cityName, season, src].filter(Boolean).join(" · ");
        const name = r.fxg_name && r.fxg_name.trim()
          ? r.fxg_name
          : `${cityName} flood event`;
        return `
          <li class="history-item" data-year="${r.fxg_year}">
            <span class="history-marker" style="background:${seasonColor}" aria-hidden="true"></span>
            <span class="history-year">${r.fxg_year}</span>
            <div class="history-body">
              <p class="history-text">${escapeHtml(name)}</p>
              <p class="history-meta">${escapeHtml(meta)}</p>
            </div>
          </li>
        `;
      })
      .join("");
  }

  function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, (c) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    })[c]);
  }

  function adjustForUKAspect(geojson, centralLat) {
    const k = Math.cos((centralLat * Math.PI) / 180);
    function transformCoords(coords) {
      if (typeof coords[0] === "number") {
        return [coords[0] * k, coords[1]];
      }
      return coords.map(transformCoords);
    }
    return {
      type: "FeatureCollection",
      features: geojson.features.map((f) => ({
        type: "Feature",
        properties: f.properties,
        geometry: {
          type: f.geometry.type,
          coordinates: transformCoords(f.geometry.coordinates),
        },
      })),
    };
  }
})();
