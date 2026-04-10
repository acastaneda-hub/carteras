import { useState, useRef, useCallback, useEffect } from "react";

const DEFAULT_PARAMS = {
  conservadora: {
    label: "Conservadora",
    color: "#2E7D32",
    icon: "🛡️",
    rules: [
      { asset: "Renta Fija Soberana (Letras, Bonos CER, Lecaps, etc.)", min: 40, max: 100 },
      { asset: "Cauciones / Money Market", min: 0, max: 40 },
      { asset: "ONs Investment Grade", min: 0, max: 30 },
      { asset: "Renta Variable (Acciones, CEDEARs)", min: 0, max: 10 },
      { asset: "FCI Renta Fija / T+1", min: 0, max: 30 },
    ],
    maxEquityPct: 10,
    maxHighYieldPct: 5,
    description: "Capital preservation, baja volatilidad, horizonte corto"
  },
  moderada: {
    label: "Moderada",
    color: "#F57C00",
    icon: "⚖️",
    rules: [
      { asset: "Renta Fija Soberana (Letras, Bonos CER, Lecaps, etc.)", min: 20, max: 60 },
      { asset: "Cauciones / Money Market", min: 0, max: 20 },
      { asset: "ONs Investment Grade", min: 0, max: 30 },
      { asset: "Renta Variable (Acciones, CEDEARs)", min: 10, max: 40 },
      { asset: "FCI Renta Fija / T+1", min: 0, max: 20 },
      { asset: "ONs High Yield", min: 0, max: 15 },
    ],
    maxEquityPct: 40,
    maxHighYieldPct: 15,
    description: "Balance riesgo/retorno, horizonte medio"
  },
  arriesgada: {
    label: "Arriesgada",
    color: "#C62828",
    icon: "🔥",
    rules: [
      { asset: "Renta Variable (Acciones, CEDEARs)", min: 30, max: 80 },
      { asset: "Renta Fija Soberana (Letras, Bonos CER, Lecaps, etc.)", min: 0, max: 30 },
      { asset: "ONs High Yield", min: 0, max: 30 },
      { asset: "Cauciones / Money Market", min: 0, max: 10 },
      { asset: "Opciones / Futuros", min: 0, max: 20 },
    ],
    maxEquityPct: 80,
    maxHighYieldPct: 30,
    description: "Maximizar retorno, alta volatilidad, horizonte largo"
  }
};

const FONT_LINK = "https://fonts.googleapis.com/css2?family=Montserrat:wght@400;500;600;700;800&family=DM+Sans:wght@400;500;600&display=swap";

function App() {
  const [params, setParams] = useState(DEFAULT_PARAMS);
  const [activeTab, setActiveTab] = useState("config");
  const [editingProfile, setEditingProfile] = useState("conservadora");
  const [pdfFile, setPdfFile] = useState(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [dragOver, setDragOver] = useState(false);
  const fileRef = useRef(null);

  useEffect(() => {
    if (!document.querySelector(`link[href="${FONT_LINK}"]`)) {
      const link = document.createElement("link");
      link.rel = "stylesheet";
      link.href = FONT_LINK;
      document.head.appendChild(link);
    }
  }, []);

  const updateRule = (profile, idx, field, value) => {
    setParams(prev => {
      const next = JSON.parse(JSON.stringify(prev));
      next[profile].rules[idx][field] = field === "asset" ? value : Number(value);
      return next;
    });
  };

  const addRule = (profile) => {
    setParams(prev => {
      const next = JSON.parse(JSON.stringify(prev));
      next[profile].rules.push({ asset: "Nueva categoría", min: 0, max: 0 });
      return next;
    });
  };

  const removeRule = (profile, idx) => {
    setParams(prev => {
      const next = JSON.parse(JSON.stringify(prev));
      next[profile].rules.splice(idx, 1);
      return next;
    });
  };

  const updateProfileField = (profile, field, value) => {
    setParams(prev => {
      const next = JSON.parse(JSON.stringify(prev));
      next[profile][field] = field === "description" ? value : Number(value);
      return next;
    });
  };

  const handleFileDrop = useCallback((e) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer?.files?.[0] || e.target?.files?.[0];
    if (file && file.type === "application/pdf") {
      setPdfFile(file);
      setResult(null);
      setError(null);
    } else {
      setError("Por favor subí un archivo PDF válido.");
    }
  }, []);

  const analyzePDF = async () => {
    if (!pdfFile) return;
    setAnalyzing(true);
    setError(null);
    setResult(null);

    try {
      const base64 = await new Promise((res, rej) => {
        const r = new FileReader();
        r.onload = () => res(r.result.split(",")[1]);
        r.onerror = () => rej(new Error("Error leyendo archivo"));
        r.readAsDataURL(pdfFile);
      });

      const paramsDescription = Object.entries(params).map(([key, p]) => {
        const rulesText = p.rules.map(r => `  - ${r.asset}: min ${r.min}%, max ${r.max}%`).join("\n");
        return `### ${p.label} (${p.icon})\n${p.description}\nMáx. Renta Variable: ${p.maxEquityPct}%\nMáx. High Yield: ${p.maxHighYieldPct}%\nRangos:\n${rulesText}`;
      }).join("\n\n");

      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 4000,
          messages: [{
            role: "user",
            content: [
              {
                type: "document",
                source: { type: "base64", media_type: "application/pdf", data: base64 }
              },
              {
                type: "text",
                text: `Sos un analista financiero experto en carteras de inversión del mercado argentino. 

Analizá el PDF adjunto que contiene las posiciones/tenencias de un cliente. Extraé cada posición, su valor y porcentaje del total.

Luego clasificá la cartera según estos perfiles predefinidos:

${paramsDescription}

Respondé EXCLUSIVAMENTE con un JSON válido (sin backticks, sin markdown, sin texto adicional) con esta estructura:
{
  "clientName": "nombre si se puede extraer o null",
  "totalValue": "valor total de la cartera como string con moneda",
  "positions": [
    { "ticker": "TICKER", "description": "descripción", "value": "valor como string", "percentage": 12.5, "category": "categoría de activo asignada" }
  ],
  "composition": {
    "Renta Fija Soberana": 45.2,
    "Renta Variable": 30.1,
    ...
  },
  "classification": "conservadora" | "moderada" | "arriesgada",
  "confidence": 0.85,
  "reasoning": "explicación breve de por qué se clasificó así",
  "warnings": ["lista de observaciones o alertas sobre la cartera"],
  "suggestion": "sugerencia breve de rebalanceo si aplica"
}`
              }
            ]
          }]
        })
      });

      const data = await response.json();
      
      if (data.error) {
        throw new Error(data.error.message || "Error en la API");
      }

      const text = data.content?.map(i => i.text || "").join("") || "";
      const clean = text.replace(/```json|```/g, "").trim();
      const parsed = JSON.parse(clean);
      setResult(parsed);
      setActiveTab("result");
    } catch (err) {
      console.error(err);
      setError(`Error al analizar: ${err.message}. Verificá que el PDF contenga posiciones legibles.`);
    } finally {
      setAnalyzing(false);
    }
  };

  const profileData = result ? params[result.classification] : null;

  return (
    <div style={styles.container}>
      <style>{`
        @keyframes fadeIn { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }
        @keyframes slideIn { from { opacity: 0; transform: translateX(-20px); } to { opacity: 1; transform: translateX(0); } }
        @keyframes barGrow { from { width: 0; } }
        @keyframes spin { to { transform: rotate(360deg); } }
        input[type="range"]::-webkit-slider-thumb { -webkit-appearance: none; appearance: none; width: 16px; height: 16px; border-radius: 50%; background: #1A3F47; cursor: pointer; border: 2px solid white; box-shadow: 0 1px 4px rgba(0,0,0,0.3); }
        input[type="range"]::-moz-range-thumb { width: 16px; height: 16px; border-radius: 50%; background: #1A3F47; cursor: pointer; border: 2px solid white; box-shadow: 0 1px 4px rgba(0,0,0,0.3); }
        input[type="range"] { -webkit-appearance: none; appearance: none; height: 6px; border-radius: 3px; background: #d0d5dd; outline: none; }
        * { scrollbar-width: thin; scrollbar-color: #1A3F47 transparent; }
      `}</style>

      {/* Header */}
      <div style={styles.header}>
        <div style={styles.headerInner}>
          <div style={styles.logoArea}>
            <div style={styles.logoMark}>S&C</div>
            <div>
              <div style={styles.headerTitle}>Clasificador de Carteras</div>
              <div style={styles.headerSub}>Motor de perfilamiento automático</div>
            </div>
          </div>
        </div>
        <div style={styles.headerAccent} />
      </div>

      {/* Tabs */}
      <div style={styles.tabBar}>
        {[
          { key: "config", label: "Parámetros", icon: "⚙️" },
          { key: "analyze", label: "Analizar PDF", icon: "📄" },
          { key: "result", label: "Resultado", icon: "📊", disabled: !result }
        ].map(t => (
          <button
            key={t.key}
            onClick={() => !t.disabled && setActiveTab(t.key)}
            style={{
              ...styles.tab,
              ...(activeTab === t.key ? styles.tabActive : {}),
              ...(t.disabled ? styles.tabDisabled : {}),
            }}
          >
            <span>{t.icon}</span> {t.label}
          </button>
        ))}
      </div>

      <div style={styles.content}>
        {/* CONFIG TAB */}
        {activeTab === "config" && (
          <div style={{ animation: "fadeIn 0.4s ease" }}>
            <p style={styles.sectionDesc}>
              Definí los rangos de exposición para cada perfil. Estos parámetros se usan para clasificar automáticamente las carteras de clientes.
            </p>

            {/* Profile selector */}
            <div style={styles.profileSelector}>
              {Object.entries(params).map(([key, p]) => (
                <button
                  key={key}
                  onClick={() => setEditingProfile(key)}
                  style={{
                    ...styles.profileBtn,
                    ...(editingProfile === key ? { 
                      background: p.color + "18",
                      borderColor: p.color,
                      color: p.color,
                      fontWeight: 700 
                    } : {})
                  }}
                >
                  <span style={{ fontSize: 22 }}>{p.icon}</span>
                  <span>{p.label}</span>
                </button>
              ))}
            </div>

            {/* Editing panel */}
            {(() => {
              const p = params[editingProfile];
              return (
                <div style={{ ...styles.card, borderLeft: `4px solid ${p.color}` }}>
                  <div style={styles.cardHeader}>
                    <span style={{ fontSize: 28 }}>{p.icon}</span>
                    <div>
                      <h3 style={{ ...styles.cardTitle, color: p.color }}>{p.label}</h3>
                      <input
                        value={p.description}
                        onChange={e => updateProfileField(editingProfile, "description", e.target.value)}
                        style={styles.descInput}
                        placeholder="Descripción del perfil..."
                      />
                    </div>
                  </div>

                  <div style={styles.limitsRow}>
                    <div style={styles.limitBox}>
                      <label style={styles.limitLabel}>Máx. Renta Variable</label>
                      <div style={styles.limitControl}>
                        <input
                          type="range" min="0" max="100"
                          value={p.maxEquityPct}
                          onChange={e => updateProfileField(editingProfile, "maxEquityPct", e.target.value)}
                          style={styles.slider}
                        />
                        <span style={{ ...styles.limitValue, color: p.color }}>{p.maxEquityPct}%</span>
                      </div>
                    </div>
                    <div style={styles.limitBox}>
                      <label style={styles.limitLabel}>Máx. High Yield</label>
                      <div style={styles.limitControl}>
                        <input
                          type="range" min="0" max="100"
                          value={p.maxHighYieldPct}
                          onChange={e => updateProfileField(editingProfile, "maxHighYieldPct", e.target.value)}
                          style={styles.slider}
                        />
                        <span style={{ ...styles.limitValue, color: p.color }}>{p.maxHighYieldPct}%</span>
                      </div>
                    </div>
                  </div>

                  <div style={styles.rulesHeader}>
                    <h4 style={styles.rulesTitle}>Rangos por categoría de activo</h4>
                    <button onClick={() => addRule(editingProfile)} style={{ ...styles.addBtn, color: p.color, borderColor: p.color }}>
                      + Agregar
                    </button>
                  </div>

                  {p.rules.map((rule, idx) => (
                    <div key={idx} style={{ ...styles.ruleRow, animation: `slideIn 0.3s ease ${idx * 0.05}s both` }}>
                      <input
                        value={rule.asset}
                        onChange={e => updateRule(editingProfile, idx, "asset", e.target.value)}
                        style={styles.assetInput}
                      />
                      <div style={styles.rangeGroup}>
                        <div style={styles.rangeItem}>
                          <span style={styles.rangeLabel}>Mín</span>
                          <input
                            type="number" min="0" max="100"
                            value={rule.min}
                            onChange={e => updateRule(editingProfile, idx, "min", e.target.value)}
                            style={styles.numInput}
                          />
                          <span style={styles.pctSign}>%</span>
                        </div>
                        <div style={styles.rangeSep}>—</div>
                        <div style={styles.rangeItem}>
                          <span style={styles.rangeLabel}>Máx</span>
                          <input
                            type="number" min="0" max="100"
                            value={rule.max}
                            onChange={e => updateRule(editingProfile, idx, "max", e.target.value)}
                            style={styles.numInput}
                          />
                          <span style={styles.pctSign}>%</span>
                        </div>
                        {/* Visual bar */}
                        <div style={styles.miniBar}>
                          <div style={{
                            position: "absolute", left: `${rule.min}%`, width: `${rule.max - rule.min}%`,
                            height: "100%", borderRadius: 3, background: p.color + "55",
                          }} />
                        </div>
                      </div>
                      <button onClick={() => removeRule(editingProfile, idx)} style={styles.removeBtn}>✕</button>
                    </div>
                  ))}
                </div>
              );
            })()}
          </div>
        )}

        {/* ANALYZE TAB */}
        {activeTab === "analyze" && (
          <div style={{ animation: "fadeIn 0.4s ease" }}>
            <p style={styles.sectionDesc}>
              Subí el PDF con las posiciones/tenencias del cliente. Claude va a extraer cada posición, calcular la composición y clasificar la cartera según tus parámetros.
            </p>

            <div
              onDrop={handleFileDrop}
              onDragOver={e => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onClick={() => fileRef.current?.click()}
              style={{
                ...styles.dropzone,
                ...(dragOver ? styles.dropzoneActive : {}),
                ...(pdfFile ? styles.dropzoneLoaded : {}),
              }}
            >
              <input
                ref={fileRef}
                type="file"
                accept=".pdf"
                onChange={handleFileDrop}
                style={{ display: "none" }}
              />
              {pdfFile ? (
                <div style={styles.fileLoaded}>
                  <div style={styles.fileIcon}>📄</div>
                  <div style={styles.fileName}>{pdfFile.name}</div>
                  <div style={styles.fileSize}>{(pdfFile.size / 1024).toFixed(0)} KB</div>
                  <div style={styles.fileChange}>Click para cambiar archivo</div>
                </div>
              ) : (
                <div style={styles.dropContent}>
                  <div style={styles.dropIcon}>
                    <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
                      <rect x="8" y="6" width="32" height="36" rx="4" stroke="#1A3F47" strokeWidth="2.5" fill="none" />
                      <path d="M16 20l8-8 8 8M24 12v20" stroke="#93D500" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </div>
                  <div style={styles.dropText}>Arrastrá el PDF acá o hacé click</div>
                  <div style={styles.dropHint}>Soporta extractos de cuenta, reportes de tenencias, estados de cartera</div>
                </div>
              )}
            </div>

            {pdfFile && (
              <button
                onClick={analyzePDF}
                disabled={analyzing}
                style={{
                  ...styles.analyzeBtn,
                  ...(analyzing ? styles.analyzeBtnLoading : {}),
                }}
              >
                {analyzing ? (
                  <>
                    <div style={styles.spinner} />
                    Analizando con Claude...
                  </>
                ) : (
                  <>🔍 Clasificar Cartera</>
                )}
              </button>
            )}

            {error && (
              <div style={styles.errorBox}>
                <span>⚠️</span> {error}
              </div>
            )}

            {/* Quick params preview */}
            <div style={styles.previewSection}>
              <h4 style={styles.previewTitle}>Perfiles activos</h4>
              <div style={styles.previewGrid}>
                {Object.entries(params).map(([key, p]) => (
                  <div key={key} style={{ ...styles.previewCard, borderTop: `3px solid ${p.color}` }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                      <span style={{ fontSize: 18 }}>{p.icon}</span>
                      <span style={{ fontWeight: 700, color: p.color, fontFamily: "Montserrat, sans-serif", fontSize: 13 }}>{p.label}</span>
                    </div>
                    <div style={{ fontSize: 11, color: "#667", lineHeight: 1.5 }}>
                      RV máx: {p.maxEquityPct}% · HY máx: {p.maxHighYieldPct}%
                    </div>
                    <div style={{ fontSize: 11, color: "#999", marginTop: 4 }}>{p.rules.length} categorías</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* RESULT TAB */}
        {activeTab === "result" && result && profileData && (
          <div style={{ animation: "fadeIn 0.4s ease" }}>
            {/* Classification badge */}
            <div style={{ ...styles.resultBadge, background: profileData.color + "12", borderColor: profileData.color }}>
              <div style={styles.badgeIcon}>{profileData.icon}</div>
              <div>
                <div style={styles.badgeCategory}>Cartera clasificada como</div>
                <div style={{ ...styles.badgeLabel, color: profileData.color }}>{profileData.label}</div>
                <div style={styles.badgeConfidence}>
                  Confianza: {(result.confidence * 100).toFixed(0)}%
                  <div style={styles.confidenceBar}>
                    <div style={{ ...styles.confidenceFill, width: `${result.confidence * 100}%`, background: profileData.color, animation: "barGrow 1s ease" }} />
                  </div>
                </div>
              </div>
            </div>

            {/* Client info */}
            <div style={styles.infoRow}>
              {result.clientName && (
                <div style={styles.infoItem}>
                  <span style={styles.infoLabel}>Cliente</span>
                  <span style={styles.infoValue}>{result.clientName}</span>
                </div>
              )}
              {result.totalValue && (
                <div style={styles.infoItem}>
                  <span style={styles.infoLabel}>Valor Total</span>
                  <span style={styles.infoValue}>{result.totalValue}</span>
                </div>
              )}
            </div>

            {/* Reasoning */}
            <div style={styles.reasoningBox}>
              <div style={styles.reasoningTitle}>💡 Análisis</div>
              <p style={styles.reasoningText}>{result.reasoning}</p>
            </div>

            {/* Composition chart */}
            {result.composition && (
              <div style={styles.card}>
                <h4 style={styles.chartTitle}>Composición de la Cartera</h4>
                <div style={styles.chartArea}>
                  {Object.entries(result.composition)
                    .sort((a, b) => b[1] - a[1])
                    .map(([cat, pct], i) => {
                      const colors = ["#1A3F47", "#93D500", "#2E7D32", "#F57C00", "#C62828", "#5C6BC0", "#00897B", "#8D6E63"];
                      const c = colors[i % colors.length];
                      return (
                        <div key={cat} style={{ ...styles.barRow, animation: `slideIn 0.4s ease ${i * 0.08}s both` }}>
                          <div style={styles.barLabel}>{cat}</div>
                          <div style={styles.barTrack}>
                            <div style={{ ...styles.barFill, width: `${pct}%`, background: c, animation: `barGrow 0.8s ease ${i * 0.1}s both` }} />
                          </div>
                          <div style={{ ...styles.barValue, color: c }}>{pct.toFixed(1)}%</div>
                        </div>
                      );
                    })}
                </div>
              </div>
            )}

            {/* Positions table */}
            {result.positions?.length > 0 && (
              <div style={styles.card}>
                <h4 style={styles.chartTitle}>Posiciones Detalladas</h4>
                <div style={{ overflowX: "auto" }}>
                  <table style={styles.table}>
                    <thead>
                      <tr>
                        <th style={styles.th}>Ticker</th>
                        <th style={styles.th}>Descripción</th>
                        <th style={styles.th}>Valor</th>
                        <th style={{ ...styles.th, textAlign: "right" }}>%</th>
                        <th style={styles.th}>Categoría</th>
                      </tr>
                    </thead>
                    <tbody>
                      {result.positions.map((pos, i) => (
                        <tr key={i} style={{ animation: `fadeIn 0.3s ease ${i * 0.04}s both` }}>
                          <td style={{ ...styles.td, fontWeight: 600, color: "#1A3F47", fontFamily: "monospace" }}>{pos.ticker}</td>
                          <td style={styles.td}>{pos.description}</td>
                          <td style={{ ...styles.td, fontFamily: "monospace" }}>{pos.value}</td>
                          <td style={{ ...styles.td, textAlign: "right", fontWeight: 600 }}>{pos.percentage?.toFixed(1)}%</td>
                          <td style={styles.td}>
                            <span style={styles.categoryTag}>{pos.category}</span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Warnings */}
            {result.warnings?.length > 0 && (
              <div style={styles.warningBox}>
                <div style={styles.warningTitle}>⚠️ Observaciones</div>
                {result.warnings.map((w, i) => (
                  <div key={i} style={styles.warningItem}>• {w}</div>
                ))}
              </div>
            )}

            {/* Suggestion */}
            {result.suggestion && (
              <div style={styles.suggestionBox}>
                <div style={styles.suggestionTitle}>💼 Sugerencia de Rebalanceo</div>
                <p style={styles.suggestionText}>{result.suggestion}</p>
              </div>
            )}

            <button onClick={() => { setResult(null); setPdfFile(null); setActiveTab("analyze"); }} style={styles.newBtn}>
              Analizar otra cartera →
            </button>
          </div>
        )}
      </div>

      <div style={styles.footer}>
        S&C Inversiones S.A. — Clasificador interno · Los resultados son orientativos
      </div>
    </div>
  );
}

const styles = {
  container: {
    fontFamily: "'DM Sans', sans-serif",
    background: "#f5f6f8",
    minHeight: "100vh",
    color: "#1a1a2e",
  },
  header: {
    background: "#1A3F47",
    position: "relative",
    overflow: "hidden",
  },
  headerInner: {
    padding: "20px 24px",
    position: "relative",
    zIndex: 1,
  },
  logoArea: {
    display: "flex",
    alignItems: "center",
    gap: 14,
  },
  logoMark: {
    width: 44,
    height: 44,
    borderRadius: 10,
    background: "#93D500",
    color: "#1A3F47",
    fontFamily: "Montserrat, sans-serif",
    fontWeight: 800,
    fontSize: 16,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    letterSpacing: "-0.5px",
  },
  headerTitle: {
    color: "white",
    fontFamily: "Montserrat, sans-serif",
    fontWeight: 700,
    fontSize: 18,
    letterSpacing: "-0.3px",
  },
  headerSub: {
    color: "#93D500",
    fontSize: 12,
    fontWeight: 500,
    marginTop: 2,
    letterSpacing: "0.5px",
    textTransform: "uppercase",
  },
  headerAccent: {
    height: 3,
    background: "linear-gradient(90deg, #93D500, #93D50000)",
  },
  tabBar: {
    display: "flex",
    background: "white",
    borderBottom: "1px solid #e8eaed",
    padding: "0 16px",
    gap: 0,
  },
  tab: {
    padding: "14px 18px",
    border: "none",
    background: "none",
    fontSize: 13,
    fontWeight: 500,
    color: "#888",
    cursor: "pointer",
    borderBottom: "2px solid transparent",
    fontFamily: "'DM Sans', sans-serif",
    display: "flex",
    alignItems: "center",
    gap: 6,
    transition: "all 0.2s",
  },
  tabActive: {
    color: "#1A3F47",
    borderBottomColor: "#93D500",
    fontWeight: 600,
  },
  tabDisabled: {
    opacity: 0.35,
    cursor: "default",
  },
  content: {
    padding: "20px 20px 80px",
    maxWidth: 780,
    margin: "0 auto",
  },
  sectionDesc: {
    fontSize: 14,
    color: "#555",
    lineHeight: 1.6,
    marginBottom: 20,
  },
  profileSelector: {
    display: "flex",
    gap: 10,
    marginBottom: 20,
    flexWrap: "wrap",
  },
  profileBtn: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    padding: "10px 18px",
    border: "2px solid #ddd",
    borderRadius: 10,
    background: "white",
    cursor: "pointer",
    fontFamily: "Montserrat, sans-serif",
    fontWeight: 500,
    fontSize: 13,
    color: "#555",
    transition: "all 0.2s",
  },
  card: {
    background: "white",
    borderRadius: 12,
    padding: 20,
    boxShadow: "0 1px 4px rgba(0,0,0,0.06)",
    marginBottom: 16,
  },
  cardHeader: {
    display: "flex",
    alignItems: "flex-start",
    gap: 14,
    marginBottom: 20,
  },
  cardTitle: {
    fontFamily: "Montserrat, sans-serif",
    fontWeight: 700,
    fontSize: 20,
    margin: 0,
  },
  descInput: {
    border: "none",
    borderBottom: "1px dashed #ccc",
    fontSize: 13,
    color: "#666",
    width: "100%",
    padding: "4px 0",
    marginTop: 4,
    fontFamily: "'DM Sans', sans-serif",
    outline: "none",
  },
  limitsRow: {
    display: "flex",
    gap: 16,
    marginBottom: 20,
    flexWrap: "wrap",
  },
  limitBox: {
    flex: 1,
    minWidth: 200,
    background: "#f8f9fb",
    borderRadius: 8,
    padding: "12px 16px",
  },
  limitLabel: {
    fontSize: 11,
    fontWeight: 600,
    color: "#888",
    textTransform: "uppercase",
    letterSpacing: "0.5px",
  },
  limitControl: {
    display: "flex",
    alignItems: "center",
    gap: 12,
    marginTop: 8,
  },
  slider: {
    flex: 1,
    cursor: "pointer",
  },
  limitValue: {
    fontFamily: "Montserrat, sans-serif",
    fontWeight: 700,
    fontSize: 18,
    minWidth: 48,
    textAlign: "right",
  },
  rulesHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  rulesTitle: {
    fontFamily: "Montserrat, sans-serif",
    fontWeight: 600,
    fontSize: 14,
    color: "#333",
    margin: 0,
  },
  addBtn: {
    border: "1.5px dashed",
    background: "none",
    borderRadius: 6,
    padding: "6px 14px",
    fontSize: 12,
    fontWeight: 600,
    cursor: "pointer",
    fontFamily: "'DM Sans', sans-serif",
  },
  ruleRow: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    padding: "10px 0",
    borderBottom: "1px solid #f0f0f0",
    flexWrap: "wrap",
  },
  assetInput: {
    flex: "1 1 200px",
    border: "1px solid #e0e0e0",
    borderRadius: 6,
    padding: "8px 10px",
    fontSize: 13,
    fontFamily: "'DM Sans', sans-serif",
    outline: "none",
    minWidth: 180,
  },
  rangeGroup: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    flexShrink: 0,
  },
  rangeItem: {
    display: "flex",
    alignItems: "center",
    gap: 4,
  },
  rangeLabel: {
    fontSize: 10,
    fontWeight: 600,
    color: "#999",
    textTransform: "uppercase",
  },
  numInput: {
    width: 50,
    border: "1px solid #e0e0e0",
    borderRadius: 6,
    padding: "6px 8px",
    fontSize: 13,
    textAlign: "center",
    fontFamily: "monospace",
    outline: "none",
  },
  pctSign: {
    fontSize: 12,
    color: "#999",
    fontWeight: 500,
  },
  rangeSep: {
    color: "#ccc",
    fontSize: 14,
  },
  miniBar: {
    width: 60,
    height: 6,
    background: "#eee",
    borderRadius: 3,
    position: "relative",
    overflow: "hidden",
    marginLeft: 4,
  },
  removeBtn: {
    border: "none",
    background: "none",
    color: "#ccc",
    fontSize: 16,
    cursor: "pointer",
    padding: "4px 8px",
    borderRadius: 4,
    transition: "color 0.2s",
  },
  dropzone: {
    border: "2px dashed #c8cdd4",
    borderRadius: 16,
    padding: "48px 24px",
    textAlign: "center",
    cursor: "pointer",
    transition: "all 0.3s",
    background: "white",
    marginBottom: 20,
  },
  dropzoneActive: {
    borderColor: "#93D500",
    background: "#93D50008",
  },
  dropzoneLoaded: {
    borderColor: "#1A3F47",
    borderStyle: "solid",
    background: "#1A3F4706",
  },
  dropContent: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: 12,
  },
  dropIcon: { opacity: 0.7 },
  dropText: {
    fontFamily: "Montserrat, sans-serif",
    fontWeight: 600,
    fontSize: 15,
    color: "#1A3F47",
  },
  dropHint: {
    fontSize: 12,
    color: "#888",
  },
  fileLoaded: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: 6,
  },
  fileIcon: { fontSize: 36 },
  fileName: {
    fontFamily: "Montserrat, sans-serif",
    fontWeight: 600,
    fontSize: 15,
    color: "#1A3F47",
  },
  fileSize: { fontSize: 12, color: "#888" },
  fileChange: { fontSize: 11, color: "#93D500", fontWeight: 500, marginTop: 4 },
  analyzeBtn: {
    width: "100%",
    padding: "16px",
    border: "none",
    borderRadius: 12,
    background: "#1A3F47",
    color: "white",
    fontFamily: "Montserrat, sans-serif",
    fontWeight: 700,
    fontSize: 15,
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    transition: "all 0.2s",
    marginBottom: 20,
  },
  analyzeBtnLoading: {
    background: "#2a5f6a",
    cursor: "wait",
  },
  spinner: {
    width: 18,
    height: 18,
    border: "2px solid rgba(255,255,255,0.3)",
    borderTopColor: "#93D500",
    borderRadius: "50%",
    animation: "spin 0.8s linear infinite",
  },
  errorBox: {
    background: "#FFF3F0",
    border: "1px solid #FFCCC0",
    borderRadius: 10,
    padding: "14px 18px",
    fontSize: 13,
    color: "#C62828",
    display: "flex",
    alignItems: "flex-start",
    gap: 8,
    marginBottom: 16,
  },
  previewSection: {
    marginTop: 24,
  },
  previewTitle: {
    fontFamily: "Montserrat, sans-serif",
    fontWeight: 600,
    fontSize: 13,
    color: "#999",
    textTransform: "uppercase",
    letterSpacing: "0.5px",
    marginBottom: 12,
  },
  previewGrid: {
    display: "flex",
    gap: 12,
    flexWrap: "wrap",
  },
  previewCard: {
    flex: "1 1 180px",
    background: "white",
    borderRadius: 8,
    padding: "14px 16px",
    boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
  },
  resultBadge: {
    display: "flex",
    alignItems: "center",
    gap: 18,
    padding: "24px",
    borderRadius: 16,
    border: "2px solid",
    marginBottom: 20,
  },
  badgeIcon: { fontSize: 48 },
  badgeCategory: {
    fontSize: 12,
    color: "#888",
    fontWeight: 500,
    textTransform: "uppercase",
    letterSpacing: "0.5px",
  },
  badgeLabel: {
    fontFamily: "Montserrat, sans-serif",
    fontWeight: 800,
    fontSize: 28,
    letterSpacing: "-0.5px",
  },
  badgeConfidence: {
    fontSize: 12,
    color: "#666",
    marginTop: 6,
    display: "flex",
    alignItems: "center",
    gap: 10,
  },
  confidenceBar: {
    width: 100,
    height: 6,
    background: "#eee",
    borderRadius: 3,
    overflow: "hidden",
  },
  confidenceFill: {
    height: "100%",
    borderRadius: 3,
  },
  infoRow: {
    display: "flex",
    gap: 16,
    marginBottom: 16,
    flexWrap: "wrap",
  },
  infoItem: {
    background: "white",
    borderRadius: 10,
    padding: "14px 18px",
    flex: "1 1 160px",
    boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
  },
  infoLabel: {
    display: "block",
    fontSize: 11,
    color: "#999",
    fontWeight: 600,
    textTransform: "uppercase",
    letterSpacing: "0.5px",
    marginBottom: 4,
  },
  infoValue: {
    fontFamily: "Montserrat, sans-serif",
    fontWeight: 700,
    fontSize: 16,
    color: "#1A3F47",
  },
  reasoningBox: {
    background: "#1A3F4708",
    borderRadius: 12,
    padding: "16px 20px",
    marginBottom: 16,
    borderLeft: "3px solid #1A3F47",
  },
  reasoningTitle: {
    fontFamily: "Montserrat, sans-serif",
    fontWeight: 700,
    fontSize: 14,
    marginBottom: 8,
    color: "#1A3F47",
  },
  reasoningText: {
    fontSize: 13,
    lineHeight: 1.7,
    color: "#444",
    margin: 0,
  },
  chartTitle: {
    fontFamily: "Montserrat, sans-serif",
    fontWeight: 700,
    fontSize: 15,
    color: "#1A3F47",
    margin: "0 0 16px",
  },
  chartArea: {
    display: "flex",
    flexDirection: "column",
    gap: 10,
  },
  barRow: {
    display: "flex",
    alignItems: "center",
    gap: 10,
  },
  barLabel: {
    flex: "0 0 180px",
    fontSize: 12,
    color: "#555",
    textAlign: "right",
    fontWeight: 500,
  },
  barTrack: {
    flex: 1,
    height: 20,
    background: "#f0f1f3",
    borderRadius: 4,
    overflow: "hidden",
  },
  barFill: {
    height: "100%",
    borderRadius: 4,
    minWidth: 2,
  },
  barValue: {
    flex: "0 0 52px",
    fontSize: 13,
    fontWeight: 700,
    fontFamily: "Montserrat, sans-serif",
    textAlign: "right",
  },
  table: {
    width: "100%",
    borderCollapse: "collapse",
    fontSize: 12,
  },
  th: {
    textAlign: "left",
    padding: "10px 12px",
    borderBottom: "2px solid #1A3F47",
    fontFamily: "Montserrat, sans-serif",
    fontWeight: 700,
    fontSize: 11,
    color: "#1A3F47",
    textTransform: "uppercase",
    letterSpacing: "0.5px",
  },
  td: {
    padding: "10px 12px",
    borderBottom: "1px solid #f0f0f0",
    fontSize: 12,
    color: "#444",
  },
  categoryTag: {
    display: "inline-block",
    background: "#1A3F4710",
    color: "#1A3F47",
    padding: "3px 8px",
    borderRadius: 4,
    fontSize: 10,
    fontWeight: 600,
  },
  warningBox: {
    background: "#FFF8E1",
    border: "1px solid #FFE082",
    borderRadius: 12,
    padding: "16px 20px",
    marginBottom: 16,
  },
  warningTitle: {
    fontFamily: "Montserrat, sans-serif",
    fontWeight: 700,
    fontSize: 14,
    marginBottom: 10,
    color: "#F57C00",
  },
  warningItem: {
    fontSize: 13,
    color: "#7A5C00",
    lineHeight: 1.6,
  },
  suggestionBox: {
    background: "#E8F5E9",
    border: "1px solid #A5D6A7",
    borderRadius: 12,
    padding: "16px 20px",
    marginBottom: 20,
  },
  suggestionTitle: {
    fontFamily: "Montserrat, sans-serif",
    fontWeight: 700,
    fontSize: 14,
    marginBottom: 8,
    color: "#2E7D32",
  },
  suggestionText: {
    fontSize: 13,
    color: "#2E7D32",
    lineHeight: 1.6,
    margin: 0,
  },
  newBtn: {
    width: "100%",
    padding: "14px",
    border: "2px solid #1A3F47",
    borderRadius: 10,
    background: "transparent",
    color: "#1A3F47",
    fontFamily: "Montserrat, sans-serif",
    fontWeight: 700,
    fontSize: 14,
    cursor: "pointer",
  },
  footer: {
    position: "fixed",
    bottom: 0,
    left: 0,
    right: 0,
    background: "#1A3F47",
    color: "#93D500",
    fontSize: 11,
    padding: "10px 20px",
    textAlign: "center",
    fontWeight: 500,
    letterSpacing: "0.3px",
  },
};

export default App;
