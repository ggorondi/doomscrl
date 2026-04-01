"use client";

/**
 * Detailed pipeline diagram showing the actual model architecture internals.
 * Rendered as an intricate SVG with proper data flow arrows.
 */
export default function PipelineDiagram() {
  return (
    <div className="card" style={{ padding: "1.5rem", overflowX: "auto" }}>
      <svg
        viewBox="0 0 1000 820"
        className="w-full"
        style={{ minWidth: 960, maxWidth: 1360 }}
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <marker id="arrow" markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto">
            <path d="M0,0 L8,3 L0,6" fill="#9CA3AF" />
          </marker>
          <marker id="arrow-red" markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto">
            <path d="M0,0 L8,3 L0,6" fill="#DC2626" />
          </marker>
          <marker id="arrow-purple" markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto">
            <path d="M0,0 L8,3 L0,6" fill="#8B5CF6" />
          </marker>
          <linearGradient id="inferno-grad" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#000004" />
            <stop offset="25%" stopColor="#420A68" />
            <stop offset="50%" stopColor="#932567" />
            <stop offset="75%" stopColor="#DD513A" />
            <stop offset="100%" stopColor="#FCFFA4" />
          </linearGradient>
          <pattern id="grid-pattern" width="20" height="20" patternUnits="userSpaceOnUse">
            <path d="M20,0 L0,0 L0,20" fill="none" stroke="#F3F4F6" strokeWidth="0.5" />
          </pattern>
        </defs>

        {/* Background grid */}
        <rect width="1000" height="820" fill="url(#grid-pattern)" rx="8" opacity="0.5" />

        {/* ===== ROW 1: INPUT ===== */}
        {/* TikTok Video */}
        <g transform="translate(30, 20)">
          <rect width="140" height="110" rx="6" fill="#111827" />
          {/* Fake video frame lines */}
          <rect x="10" y="10" width="120" height="68" rx="4" fill="#1F2937" />
          <rect x="18" y="84" width="50" height="4" rx="2" fill="#374151" />
          <rect x="18" y="92" width="30" height="4" rx="2" fill="#374151" />
          {/* Play icon */}
          <polygon points="60,34 60,54 76,44" fill="#6B7280" />
          <text x="70" y="106" textAnchor="middle" fill="#9CA3AF" fontSize="9" fontFamily="monospace">TikTok Video</text>
        </g>
        <text x="100" y="145" textAnchor="middle" fill="#6B7280" fontSize="10" fontFamily="monospace">9:16 aspect · muted</text>
        <text x="100" y="157" textAnchor="middle" fill="#6B7280" fontSize="10" fontFamily="monospace">878 real videos</text>

        {/* Arrow from video → split into visual + audio */}
        <path d="M170,75 L210,75" stroke="#9CA3AF" strokeWidth="1.5" markerEnd="url(#arrow)" strokeDasharray="4,3" />

        {/* ===== VISUAL BRANCH ===== */}
        <g transform="translate(220, 12)">
          <rect width="160" height="80" rx="6" fill="#EFF6FF" stroke="#3B82F6" strokeWidth="1.5" />
          <text x="80" y="18" textAnchor="middle" fill="#3B82F6" fontSize="11" fontWeight="bold" fontFamily="monospace">V-JEPA 2</text>
          <text x="80" y="32" textAnchor="middle" fill="#6B7280" fontSize="9" fontFamily="monospace">Video encoder (frozen)</text>
          {/* Layers representation */}
          {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
            <rect key={i} x={20 + i * 16} y="42" width="12" height="28" rx="2"
              fill="#BFDBFE" stroke="#3B82F6" strokeWidth="0.5" opacity={0.5 + i * 0.06} />
          ))}
          <text x="80" y="63" textAnchor="middle" fill="#3B82F6" fontSize="8" fontFamily="monospace">8 layer groups</text>
        </g>
        <text x="300" y="108" textAnchor="middle" fill="#3B82F6" fontSize="9" fontFamily="monospace">→ [8 × 1280] @ 2Hz</text>

        {/* ===== AUDIO BRANCH ===== */}
        <g transform="translate(220, 100)">
          <rect width="160" height="80" rx="6" fill="#F0FDF4" stroke="#16A34A" strokeWidth="1.5" />
          <text x="80" y="18" textAnchor="middle" fill="#16A34A" fontSize="11" fontWeight="bold" fontFamily="monospace">W2V-BERT 2.0</text>
          <text x="80" y="32" textAnchor="middle" fill="#6B7280" fontSize="9" fontFamily="monospace">Audio encoder (frozen)</text>
          {[0, 1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
            <rect key={i} x={18 + i * 14} y="42" width="10" height="28" rx="2"
              fill="#BBF7D0" stroke="#16A34A" strokeWidth="0.5" opacity={0.5 + i * 0.05} />
          ))}
          <text x="80" y="63" textAnchor="middle" fill="#16A34A" fontSize="8" fontFamily="monospace">9 layer groups</text>
        </g>
        <text x="300" y="197" textAnchor="middle" fill="#16A34A" fontSize="9" fontFamily="monospace">→ [9 × 1024] @ 2Hz</text>

        {/* GPU badge */}
        <g transform="translate(210, 188)">
          <rect width="65" height="16" rx="8" fill="#FEF2F2" stroke="#DC2626" strokeWidth="0.8" />
          <text x="33" y="12" textAnchor="middle" fill="#DC2626" fontSize="8" fontWeight="bold" fontFamily="monospace">GPU ONLY</text>
        </g>

        {/* Arrows from encoders → Projectors */}
        <path d="M380,52 L420,52 L420,230 L440,230" stroke="#3B82F6" strokeWidth="1.5" markerEnd="url(#arrow)" />
        <path d="M380,140 L410,140 L410,250 L440,250" stroke="#16A34A" strokeWidth="1.5" markerEnd="url(#arrow)" />

        {/* ===== PROJECTORS + COMBINER ===== */}
        <g transform="translate(440, 205)">
          <rect width="130" height="80" rx="6" fill="#F5F3FF" stroke="#8B5CF6" strokeWidth="1.5" />
          <text x="65" y="18" textAnchor="middle" fill="#8B5CF6" fontSize="10" fontWeight="bold" fontFamily="monospace">Projectors</text>
          <text x="65" y="32" textAnchor="middle" fill="#6B7280" fontSize="8" fontFamily="monospace">LayerNorm → Linear → GELU</text>
          {/* Visual proj */}
          <rect x="8" y="40" width="50" height="14" rx="3" fill="#BFDBFE" stroke="#3B82F6" strokeWidth="0.5" />
          <text x="33" y="51" textAnchor="middle" fill="#3B82F6" fontSize="7" fontFamily="monospace">→ 576d</text>
          {/* Audio proj */}
          <rect x="72" y="40" width="50" height="14" rx="3" fill="#BBF7D0" stroke="#16A34A" strokeWidth="0.5" />
          <text x="97" y="51" textAnchor="middle" fill="#16A34A" fontSize="7" fontFamily="monospace">→ 576d</text>
          {/* Concat */}
          <text x="65" y="72" textAnchor="middle" fill="#8B5CF6" fontSize="8" fontFamily="monospace">concat → 1152d</text>
        </g>

        {/* Arrow → Combiner */}
        <path d="M570,245 L600,245" stroke="#8B5CF6" strokeWidth="1.5" markerEnd="url(#arrow-purple)" />

        <g transform="translate(600, 225)">
          <rect width="80" height="40" rx="6" fill="#F5F3FF" stroke="#8B5CF6" strokeWidth="1.5" />
          <text x="40" y="16" textAnchor="middle" fill="#8B5CF6" fontSize="9" fontWeight="bold" fontFamily="monospace">Combiner</text>
          <text x="40" y="30" textAnchor="middle" fill="#6B7280" fontSize="8" fontFamily="monospace">Proj → 1152d</text>
        </g>

        {/* Arrow to pos embed + transformer */}
        <path d="M680,245 L720,245 L720,320 L440,320" stroke="#8B5CF6" strokeWidth="1.5" markerEnd="url(#arrow-purple)" />

        {/* ===== ROW 2: FMRI ENCODER TRANSFORMER ===== */}
        <g transform="translate(30, 295)">
          <rect width="650" height="150" rx="8" fill="#FAF5FF" stroke="#8B5CF6" strokeWidth="2" />
          <text x="325" y="22" textAnchor="middle" fill="#8B5CF6" fontSize="13.5" fontWeight="bold" fontFamily="monospace">FmriEncoder — 8-layer Transformer</text>

          {/* Positional embedding */}
          <g transform="translate(15, 35)">
            <rect width="80" height="50" rx="4" fill="#EDE9FE" stroke="#8B5CF6" strokeWidth="0.8" />
            <text x="40" y="18" textAnchor="middle" fill="#8B5CF6" fontSize="8" fontWeight="bold" fontFamily="monospace">+ PosEmbed</text>
            <text x="40" y="30" textAnchor="middle" fill="#6B7280" fontSize="7" fontFamily="monospace">learned</text>
            <text x="40" y="40" textAnchor="middle" fill="#6B7280" fontSize="7" fontFamily="monospace">1024 × 1152</text>
          </g>

          {/* Arrow */}
          <path d="M100,60 L120,60" stroke="#8B5CF6" strokeWidth="1" markerEnd="url(#arrow-purple)" />

          {/* Transformer blocks */}
          {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
            <g key={i} transform={`translate(${125 + i * 62}, 35)`}>
              <rect width="56" height="100" rx="4" fill="#EDE9FE" stroke="#8B5CF6" strokeWidth="0.8"
                opacity={0.6 + i * 0.05} />
              {/* ScaleNorm */}
              <rect x="4" y="6" width="48" height="12" rx="2" fill="#DDD6FE" />
              <text x="28" y="15" textAnchor="middle" fill="#7C3AED" fontSize="6" fontFamily="monospace">ScaleNorm</text>
              {/* Attention */}
              <rect x="4" y="22" width="48" height="16" rx="2" fill="#C4B5FD" />
              <text x="28" y="33" textAnchor="middle" fill="#5B21B6" fontSize="6.5" fontWeight="bold" fontFamily="monospace">Attn+RoPE</text>
              {/* Residual */}
              <text x="28" y="47" textAnchor="middle" fill="#8B5CF6" fontSize="7" fontFamily="monospace">+ α·res</text>
              {/* ScaleNorm 2 */}
              <rect x="4" y="52" width="48" height="12" rx="2" fill="#DDD6FE" />
              <text x="28" y="61" textAnchor="middle" fill="#7C3AED" fontSize="6" fontFamily="monospace">ScaleNorm</text>
              {/* FFN */}
              <rect x="4" y="68" width="48" height="16" rx="2" fill="#C4B5FD" />
              <text x="28" y="79" textAnchor="middle" fill="#5B21B6" fontSize="6.5" fontWeight="bold" fontFamily="monospace">FFN·4×</text>
              {/* Residual 2 */}
              <text x="28" y="96" textAnchor="middle" fill="#8B5CF6" fontSize="7" fontFamily="monospace">+ α·res</text>
              {/* Block number */}
              <text x="28" y="-2" textAnchor="middle" fill="#9CA3AF" fontSize="7" fontFamily="monospace">L{i + 1}</text>
            </g>
          ))}
        </g>
        <text x="355" y="460" textAnchor="middle" fill="#6B7280" fontSize="9" fontFamily="monospace">
          8 heads · 1152 hidden · RoPE positional encoding · scaled residuals · context window: 1024 steps
        </text>

        {/* Arrow from encoder → low rank head */}
        <path d="M680,395 L720,395 L720,490 L30,490 L30,510" stroke="#8B5CF6" strokeWidth="1.5" markerEnd="url(#arrow-purple)" />

        {/* ===== ROW 3: OUTPUT HEAD ===== */}
        <g transform="translate(30, 510)">
          <rect width="120" height="50" rx="6" fill="#F5F3FF" stroke="#8B5CF6" strokeWidth="1.5" />
          <text x="60" y="18" textAnchor="middle" fill="#8B5CF6" fontSize="9" fontWeight="bold" fontFamily="monospace">Low-Rank Head</text>
          <text x="60" y="32" textAnchor="middle" fill="#6B7280" fontSize="8" fontFamily="monospace">1152 → 2048</text>
          <text x="60" y="42" textAnchor="middle" fill="#6B7280" fontSize="7" fontFamily="monospace">(no bias)</text>
        </g>

        <path d="M150,535 L180,535" stroke="#8B5CF6" strokeWidth="1.5" markerEnd="url(#arrow-purple)" />

        <g transform="translate(180, 510)">
          <rect width="140" height="50" rx="6" fill="#F5F3FF" stroke="#8B5CF6" strokeWidth="1.5" />
          <text x="70" y="18" textAnchor="middle" fill="#8B5CF6" fontSize="9" fontWeight="bold" fontFamily="monospace">Subject Predictor</text>
          <text x="70" y="32" textAnchor="middle" fill="#6B7280" fontSize="8" fontFamily="monospace">2048 → 20,484</text>
          <text x="70" y="42" textAnchor="middle" fill="#6B7280" fontSize="7" fontFamily="monospace">avg across 25 subjects</text>
        </g>

        {/* Arrow to brain surface */}
        <path d="M320,535 L360,535" stroke="#DC2626" strokeWidth="2" markerEnd="url(#arrow-red)" />

        {/* Brain surface output */}
        <g transform="translate(360, 500)">
          <rect width="180" height="70" rx="8" fill="#FEF2F2" stroke="#DC2626" strokeWidth="2" />
          {/* Mini brain surface */}
          <rect x="10" y="10" width="60" height="50" rx="6" fill="url(#inferno-grad)" opacity="0.7" />
          <text x="40" y="38" textAnchor="middle" fill="white" fontSize="8" fontWeight="bold" fontFamily="monospace">fMRI</text>
          <text x="120" y="22" textAnchor="middle" fill="#DC2626" fontSize="10" fontWeight="bold" fontFamily="monospace">Brain Surface</text>
          <text x="120" y="36" textAnchor="middle" fill="#6B7280" fontSize="8" fontFamily="monospace">20,484 vertices</text>
          <text x="120" y="48" textAnchor="middle" fill="#6B7280" fontSize="8" fontFamily="monospace">fsaverage5</text>
          <text x="120" y="60" textAnchor="middle" fill="#DC2626" fontSize="7" fontFamily="monospace">per timestep</text>
        </g>

        {/* Arrow to reward */}
        <path d="M540,535 L580,535" stroke="#DC2626" strokeWidth="2" markerEnd="url(#arrow-red)" />

        {/* Reward computation */}
        <g transform="translate(580, 490)">
          <rect width="160" height="90" rx="8" fill="#FEF2F2" stroke="#DC2626" strokeWidth="2" />
          <text x="80" y="18" textAnchor="middle" fill="#DC2626" fontSize="10" fontWeight="bold" fontFamily="monospace">DopamineReward</text>
          <text x="80" y="34" textAnchor="middle" fill="#111" fontSize="9" fontFamily="monospace">r = α·|act| + β·‖Δact‖</text>
          <text x="80" y="48" textAnchor="middle" fill="#6B7280" fontSize="8" fontFamily="monospace">- switch_penalty</text>
          <text x="80" y="60" textAnchor="middle" fill="#6B7280" fontSize="8" fontFamily="monospace">- short_dwell_penalty</text>
          {/* Region computation */}
          <rect x="10" y="66" width="140" height="16" rx="3" fill="#FECACA" />
          <text x="80" y="78" textAnchor="middle" fill="#991B1B" fontSize="7" fontFamily="monospace">8 brain regions: LAD,LAV,LPD...</text>
        </g>

        {/* Arrow to PPO agent */}
        <path d="M660,580 L660,620 L30,620 L30,640" stroke="#111" strokeWidth="2" markerEnd="url(#arrow)" />

        {/* PPO Agent */}
        <g transform="translate(30, 640)">
          <rect width="940" height="30" rx="6" fill="#111827" />
          <text x="470" y="20" textAnchor="middle" fill="white" fontSize="10" fontWeight="bold" fontFamily="monospace">
            PPO-Clip Agent — MLP [256, 256] — action: [scroll?, cluster_id] — observation: [activation_history, video_features, cluster_dist, region_stats]
          </text>
        </g>

        {/* PPO outputs */}
        <path d="M250,670 L250,710" stroke="#111" strokeWidth="1.5" markerEnd="url(#arrow)" />
        <path d="M620,670 L620,710" stroke="#111" strokeWidth="1.5" markerEnd="url(#arrow)" />

        <g transform="translate(110, 710)">
          <rect width="280" height="68" rx="6" fill="#F9FAFB" stroke="#111827" strokeWidth="1.5" />
          <text x="140" y="18" textAnchor="middle" fill="#111827" fontSize="10" fontWeight="bold" fontFamily="monospace">Action Head</text>
          <rect x="20" y="30" width="100" height="22" rx="4" fill="#FEF2F2" stroke="#DC2626" strokeWidth="1" />
          <text x="70" y="44" textAnchor="middle" fill="#DC2626" fontSize="8" fontWeight="bold" fontFamily="monospace">SCROLL</text>
          <rect x="160" y="30" width="100" height="22" rx="4" fill="#F3F4F6" stroke="#6B7280" strokeWidth="1" />
          <text x="210" y="44" textAnchor="middle" fill="#374151" fontSize="8" fontWeight="bold" fontFamily="monospace">NO SCROLL</text>
        </g>

        <g transform="translate(450, 710)">
          <rect width="420" height="88" rx="6" fill="#F9FAFB" stroke="#111827" strokeWidth="1.5" />
          <text x="110" y="18" textAnchor="middle" fill="#111827" fontSize="10" fontWeight="bold" fontFamily="monospace">Cluster Selector</text>
          <text x="110" y="34" textAnchor="middle" fill="#6B7280" fontSize="8" fontFamily="monospace">cluster_id chosen by PPO</text>
          <rect x="30" y="44" width="160" height="24" rx="4" fill="#EFF6FF" stroke="#3B82F6" strokeWidth="1" />
          <text x="110" y="59" textAnchor="middle" fill="#2563EB" fontSize="8" fontWeight="bold" fontFamily="monospace">Select next cluster</text>

          <path d="M190,56 L225,56" stroke="#3B82F6" strokeWidth="1.5" markerEnd="url(#arrow)" />

          <text x="315" y="18" textAnchor="middle" fill="#111827" fontSize="10" fontWeight="bold" fontFamily="monospace">TikTok Clusters</text>
          <text x="315" y="34" textAnchor="middle" fill="#6B7280" fontSize="8" fontFamily="monospace">sample next vid from chosen cluster</text>

          {[0, 1, 2].map((i) => (
            <g key={i} transform={`translate(${232 + i * 56}, 46)`}>
              <rect width="34" height="26" rx="4" fill="#111827" />
              <rect x="4" y="4" width="26" height="14" rx="2" fill="#374151" />
              <rect x="7" y="20" width="14" height="2.5" rx="1.25" fill="#6B7280" />
              <text x="17" y="36" textAnchor="middle" fill="#6B7280" fontSize="6.5" fontFamily="monospace">c{i + 1}</text>
            </g>
          ))}
        </g>
      </svg>
    </div>
  );
}
