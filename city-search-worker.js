let datasetPromise = null;
let records = [];

function normalize(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

async function loadDataset() {
  if (!datasetPromise) {
    datasetPromise = fetch(new URL("./data/cities15000.json", self.location.href))
      .then((response) => {
        if (!response.ok) {
          throw new Error(`Unable to load cities dataset (${response.status})`);
        }
        return response.json();
      })
      .then((payload) => {
        records = payload.cities.map(([label, asciiLabel, timeZone, countryCode, population, lat, lon]) => {
          const labelNorm = normalize(label);
          const asciiNorm = normalize(asciiLabel);
          const timeZoneNorm = normalize(timeZone.replaceAll("_", " "));
          return {
            label,
            timeZone,
            countryCode,
            population,
            lat,
            lon,
            labelNorm,
            asciiNorm,
            timeZoneNorm,
            searchNorm: `${labelNorm} ${asciiNorm} ${timeZoneNorm}`.trim()
          };
        });
        return records;
      });
  }

  return datasetPromise;
}

function compareCandidate(a, b) {
  return (
    a.rank - b.rank ||
    b.population - a.population ||
    a.label.localeCompare(b.label) ||
    a.timeZone.localeCompare(b.timeZone)
  );
}

function matchRecord(record, query) {
  if (record.labelNorm === query || record.asciiNorm === query) {
    return { rank: 0, matchType: "exact" };
  }
  if (record.labelNorm.startsWith(query) || (record.asciiNorm && record.asciiNorm.startsWith(query))) {
    return { rank: 1, matchType: "city" };
  }
  if (record.labelNorm.includes(query) || (record.asciiNorm && record.asciiNorm.includes(query))) {
    return { rank: 2, matchType: "city" };
  }
  if (record.timeZoneNorm.includes(query)) {
    return { rank: 3, matchType: "zone" };
  }
  if (record.searchNorm.includes(query)) {
    return { rank: 4, matchType: "city" };
  }
  return null;
}

function searchRecords(query, limit = 6) {
  const normalized = normalize(query);
  if (!normalized) {
    return [];
  }

  const best = [];
  for (const record of records) {
    const match = matchRecord(record, normalized);
    if (!match) {
      continue;
    }

    const candidate = {
      label: record.label,
      timeZone: record.timeZone,
      countryCode: record.countryCode,
      population: record.population,
      lat: record.lat,
      lon: record.lon,
      rank: match.rank,
      matchType: match.matchType
    };

    let inserted = false;
    for (let i = 0; i < best.length; i += 1) {
      if (compareCandidate(candidate, best[i]) < 0) {
        best.splice(i, 0, candidate);
        inserted = true;
        break;
      }
    }
    if (!inserted) {
      best.push(candidate);
    }
    if (best.length > limit) {
      best.length = limit;
    }
  }

  return best;
}

function resolveRecord(value) {
  const normalized = normalize(value);
  if (!normalized) {
    return null;
  }

  const matches = searchRecords(normalized, 1);
  return matches[0] || null;
}

function lookupCities(cities) {
  const byKey = new Map(records.map((record) => [`${normalize(record.label)}|${record.timeZone}`, record]));
  return (cities || []).map((city) => {
    const record = byKey.get(`${normalize(city?.label)}|${city?.timeZone}`);
    if (!record) {
      return null;
    }
    return {
      label: record.label,
      timeZone: record.timeZone,
      lat: record.lat,
      lon: record.lon
    };
  });
}

self.addEventListener("message", async (event) => {
  const { type, requestId, query, limit, value } = event.data || {};

  try {
    await loadDataset();

    if (type === "search") {
      self.postMessage({
        type,
        requestId,
        results: searchRecords(query, limit)
      });
      return;
    }

    if (type === "resolve") {
      self.postMessage({
        type,
        requestId,
        result: resolveRecord(value)
      });
      return;
    }

    if (type === "warmup") {
      self.postMessage({ type, requestId, ok: true });
      return;
    }

    if (type === "lookup-cities") {
      self.postMessage({
        type,
        requestId,
        results: lookupCities(event.data?.cities)
      });
    }
  } catch (error) {
    self.postMessage({
      type: "error",
      requestId,
      message: error instanceof Error ? error.message : String(error)
    });
  }
});
