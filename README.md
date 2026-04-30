## Project Methodology Summary

### Mapping Risk and Value: Flood Exposure and Housing Markets Across UK Cities

## 1. Project Aim and Methodological Scope

Flood risk is increasingly recognised as an important factor in the housing market. Previous research found that homes exposed to flood risk in England sold for around 8.14% less than comparable properties in safer areas, with discounts rising to over 30% for the highest-risk homes. Studies also suggest that increasing flood probability is associated with measurable declines in both asking prices and transaction prices (Mason et al., 2024). However, these national averages do not explain how the relationship varies between places or across different types of flood exposure.

To address this gap, the project adopted a comparative urban analytics methodology using four contrasting case study cities: **Hull**, **York**, **Great Yarmouth**, and London. Hull was selected for its history of severe flood exposure linked to low elevation and drainage pressure. York represents a river city characterised by recurrent fluvial flooding. Great Yarmouth was included as a coastal settlement exposed to tidal surge and long-term sea-level risk. London was selected as a high-density metropolitan case where strong housing demand may interact differently with environmental risk.

The methodology focused on integrating multiple flood-risk categories with housing market indicators in order to compare how environmental risk and property value interact under contrasting urban conditions.

---

## 2. Data Sources

The project integrated multiple open datasets covering environmental risk, housing markets, administrative geography and urban form.

Main datasets included:

* Environment Agency Flood Zone 2 and Flood Zone 3 polygons
* Historic Recorded Flood Outlines
* HM Land Registry Price Paid Data (2018–2025)
* House Price per Square Metre dataset
* OS Code-Point Open postcode coordinates
* Postcode to OA / LAD lookup tables
* 2021 Output Area boundary polygons
* OS OpenMap Local building footprints
* Local Authority District boundaries

These datasets were selected because they allow environmental exposure, transaction values and neighbourhood geography to be analysed within one comparable framework.

---

## 3. Data Processing Workflow

Data cleaning and preprocessing were mainly carried out in QGIS and Python using **Pandas** and **GeoPandas**. Large spatial datasets were simplified and converted into vector tiles using Tippecanoe. Final outputs were hosted in Mapbox.

### 3.1 Flood Data Preparation

Flood polygon datasets were large and geometrically complex. Invalid geometries were repaired and polygon boundaries simplified in QGIS. Historic flood event tables were enhanced by creating additional temporal variables including:

* year
* month
* season

Historic flood polygons were spatially intersected with Local Authority District boundaries in order to count recorded flood extents by district. This created a national summary layer for choropleth mapping.

Flood Zone datasets exceeding web upload limits were exported as GeoJSON and converted into MBTiles vector tiles using Tippecanoe.

### 3.2 Housing Data Processing

Price Paid transaction records were cleaned by removing:

* missing postcode values
* missing transaction dates
* non-positive or invalid prices

Remaining transactions were grouped by postcode to calculate:

* average transaction price
* transaction count

Postcode data were linked to Output Areas using national lookup tables. Postcode averages were then aggregated to Output Area level using transaction-weighted averages:

oa_avg_price = Σ(price × transactions) / Σ(transactions)

This produced more stable neighbourhood indicators than raw postcode values alone.

House Price per Square Metre records were processed using the same logic. Only observations with valid postcode identifiers and positive numeric values were retained.

### 3.3 Flood Zone Classification

Postcode observations were spatially matched against Flood Zone polygons.

A hierarchical classification method was used:

* Flood Zone 3 = highest risk
* Flood Zone 2 = medium risk
* Outside zones = no flood zone

This ensured each postcode belonged to one risk category only.

Annual averages were then calculated by:

* city
* year
* flood-risk category

These outputs were used for trend analysis.

### 3.4 Building Layer Preparation

Building footprint datasets were clipped to Hull, York, Great Yarmouth and London. Geometries were simplified and reprojected to WGS84 coordinates.

Building centroids were spatially joined to Output Area price polygons so that each building inherited neighbourhood price context for 3D mapping.

---

## 4. Visualisation Implementation

The final platform was developed using:

* Mapbox GL JS
* D3.js
* HTML
* CSS
* JavaScript

### 4.1 National Flood Mapping

Historic flood counts by district were displayed as a choropleth map. Darker shading indicates a greater number of recorded flood extents.

### 4.2 Comparative Flooding Dashboard

Four case study cities were compared through stacked bar charts showing flood counts by flood type. Hover interactions reveal detailed values through tooltips.

### 4.3 Flood Risk and Housing Market Map

Flood Zone layers, Output Area housing values and 3D buildings were combined in an interactive city-scale map. Users can switch cities, toggle layers and compare flood-prone and non-flood areas.

### 4.4 Temporal Trend Charts

Line charts created in D3.js display housing value trends across risk categories over time.

---

## 5. Limitations and Technical Constraints

Several practical limitations were encountered.

### Processing Constraints

* Large flood polygon datasets created heavy computational pressure in QGIS
* Some workflows were moved to Python using GeoPandas and spatial indexing
* Large GeoJSON files exceeded Mapbox upload limits

### Visualisation Constraints

* Highly detailed buildings reduced rendering speed
* Dense overlapping flood polygons reduced cartographic clarity
* Some geometry simplification was required for web performance

---

## 6. Methodological Contribution

The project demonstrates a workflow for combining environmental risk data, housing market records and interactive mapping within a comparative urban analytics framework. By integrating national datasets with city-level case studies, the methodology enables cross-scalar analysis of how flood exposure and property values interact across contrasting urban contexts.
