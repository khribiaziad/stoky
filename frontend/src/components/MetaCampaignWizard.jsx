import { useState, useRef } from 'react';
import { ChevronRight, ChevronLeft, Upload, X, Search, Check } from 'lucide-react';
import { getMetaPages, searchMetaInterests, uploadMetaImage, createFullCampaign } from '../api';

const OBJECTIVES = [
  { value: 'OUTCOME_SALES',      label: 'Sales',      desc: 'Drive purchases on your website or app' },
  { value: 'OUTCOME_TRAFFIC',    label: 'Traffic',    desc: 'Send people to your website or landing page' },
  { value: 'OUTCOME_LEADS',      label: 'Leads',      desc: 'Collect leads for your business' },
  { value: 'OUTCOME_AWARENESS',  label: 'Awareness',  desc: 'Reach people most likely to remember your ad' },
  { value: 'OUTCOME_ENGAGEMENT', label: 'Engagement', desc: 'Get more messages, likes, and interactions' },
];

const CTAS = [
  { value: 'SHOP_NOW',         label: 'Shop Now' },
  { value: 'LEARN_MORE',       label: 'Learn More' },
  { value: 'CONTACT_US',       label: 'Contact Us' },
  { value: 'SIGN_UP',          label: 'Sign Up' },
  { value: 'WHATSAPP_MESSAGE', label: 'Send WhatsApp Message' },
];

const PLACEMENTS = [
  { value: 'facebook_feed',    label: 'Facebook Feed',      icon: '📘' },
  { value: 'facebook_story',   label: 'Facebook Story',     icon: '📘' },
  { value: 'instagram_feed',   label: 'Instagram Feed',     icon: '📷' },
  { value: 'instagram_story',  label: 'Instagram Story',    icon: '📷' },
  { value: 'instagram_reels',  label: 'Instagram Reels',    icon: '🎬' },
];

const COUNTRIES = [
  { code: 'MA', name: 'Morocco' },
  { code: 'DZ', name: 'Algeria' },
  { code: 'TN', name: 'Tunisia' },
  { code: 'EG', name: 'Egypt' },
  { code: 'SA', name: 'Saudi Arabia' },
  { code: 'AE', name: 'UAE' },
  { code: 'FR', name: 'France' },
  { code: 'US', name: 'United States' },
  { code: 'GB', name: 'United Kingdom' },
];

const fmt = (n, d = 2) => Number(n || 0).toFixed(d);

const STEPS = ['Campaign', 'Audience', 'Placements', 'Creative', 'Review'];

export default function MetaCampaignWizard({ onClose, onSuccess, usdRate }) {
  const [step, setStep] = useState(0);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Step 1 — Campaign
  const [campaignName, setCampaignName] = useState('');
  const [objective, setObjective] = useState('OUTCOME_SALES');
  const [budgetType, setBudgetType] = useState('daily');
  const [budgetUsd, setBudgetUsd] = useState('');
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');

  // Step 2 — Audience
  const [country, setCountry] = useState('MA');
  const [ageMin, setAgeMin] = useState(18);
  const [ageMax, setAgeMax] = useState(65);
  const [gender, setGender] = useState('all'); // all | male | female
  const [interestSearch, setInterestSearch] = useState('');
  const [interestResults, setInterestResults] = useState([]);
  const [selectedInterests, setSelectedInterests] = useState([]);
  const [searchingInterests, setSearchingInterests] = useState(false);

  // Step 3 — Placements
  const [placements, setPlacements] = useState(['facebook_feed', 'instagram_feed']);

  // Step 4 — Creative
  const [pages, setPages] = useState([]);
  const [pagesLoaded, setPagesLoaded] = useState(false);
  const [pageId, setPageId] = useState('');
  const [headline, setHeadline] = useState('');
  const [body, setBody] = useState('');
  const [cta, setCta] = useState('SHOP_NOW');
  const [url, setUrl] = useState('');
  const [whatsappNumber, setWhatsappNumber] = useState('');
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState('');
  const [imageHash, setImageHash] = useState('');
  const [uploadingImage, setUploadingImage] = useState(false);
  const fileRef = useRef();

  const loadPages = async () => {
    if (pagesLoaded) return;
    try {
      const res = await getMetaPages();
      setPages(res.data);
      if (res.data.length === 1) setPageId(res.data[0].id);
      setPagesLoaded(true);
    } catch { setError('Failed to load Facebook Pages'); }
  };

  const handleSearchInterests = async () => {
    if (!interestSearch.trim()) return;
    setSearchingInterests(true);
    try {
      const res = await searchMetaInterests(interestSearch);
      setInterestResults(res.data);
    } catch { setError('Failed to search interests'); }
    finally { setSearchingInterests(false); }
  };

  const toggleInterest = (interest) => {
    setSelectedInterests(prev =>
      prev.find(i => i.id === interest.id)
        ? prev.filter(i => i.id !== interest.id)
        : [...prev, { id: interest.id, name: interest.name }]
    );
  };

  const togglePlacement = (p) => {
    setPlacements(prev =>
      prev.includes(p) ? prev.filter(x => x !== p) : [...prev, p]
    );
  };

  const handleImageSelect = async (file) => {
    if (!file) return;
    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
    setUploadingImage(true);
    setError('');
    try {
      const res = await uploadMetaImage(file);
      setImageHash(res.data.hash);
    } catch (e) {
      setError(e.response?.data?.detail || 'Failed to upload image');
      setImageFile(null);
      setImagePreview('');
    } finally { setUploadingImage(false); }
  };

  const validateStep = () => {
    setError('');
    if (step === 0) {
      if (!campaignName.trim()) { setError('Campaign name is required'); return false; }
      if (!budgetUsd || parseFloat(budgetUsd) <= 0) { setError('Enter a valid budget'); return false; }
    }
    if (step === 2) {
      if (placements.length === 0) { setError('Select at least one placement'); return false; }
    }
    if (step === 3) {
      if (!pageId) { setError('Select a Facebook Page'); return false; }
      if (!headline.trim()) { setError('Headline is required'); return false; }
      if (!body.trim()) { setError('Ad text is required'); return false; }
      if (cta === 'WHATSAPP_MESSAGE' && !whatsappNumber.trim()) { setError('WhatsApp number is required'); return false; }
      if (cta !== 'WHATSAPP_MESSAGE' && !url.trim()) { setError('Destination URL is required'); return false; }
      if (!imageHash && !imagePreview) { setError('Upload an image for your ad'); return false; }
    }
    return true;
  };

  const next = () => {
    if (!validateStep()) return;
    if (step === 2) loadPages(); // preload pages before entering Creative step
    setStep(s => s + 1);
  };

  const prev = () => { setError(''); setStep(s => s - 1); };

  const handleLaunch = async (status) => {
    setLoading(true);
    setError('');
    try {
      const payload = {
        campaign_name: campaignName,
        objective,
        budget_type: budgetType,
        budget_usd: parseFloat(budgetUsd),
        start_time: startTime || undefined,
        end_time: endTime || undefined,
        targeting: {
          countries: [country],
          age_min: ageMin,
          age_max: ageMax,
          genders: gender === 'all' ? [] : gender === 'male' ? [1] : [2],
          interests: selectedInterests,
          placements,
        },
        creative: {
          page_id: pageId,
          headline,
          body,
          cta,
          url: cta !== 'WHATSAPP_MESSAGE' ? url : '',
          whatsapp_number: cta === 'WHATSAPP_MESSAGE' ? whatsappNumber : '',
          image_hash: imageHash,
        },
        status,
      };
      await createFullCampaign(payload);
      onSuccess(status === 'ACTIVE' ? 'Campaign launched successfully!' : 'Campaign saved as draft!');
      onClose();
    } catch (e) {
      setError(e.response?.data?.detail || 'Failed to create campaign');
    } finally { setLoading(false); }
  };

  const s = { color: '#8892b0', fontSize: 13 };
  const card = { background: '#1d1d27', borderRadius: 10, padding: 16, border: '1px solid #2d3248', marginBottom: 12 };

  return (
    <div className="modal-overlay">
      <div className="modal" style={{ maxWidth: 600, width: '95vw', maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}>

        {/* Header */}
        <div className="modal-header">
          <div>
            <h2 style={{ margin: 0 }}>New Meta Campaign</h2>
            <div style={{ fontSize: 12, color: '#8892b0', marginTop: 3 }}>
              Step {step + 1} of {STEPS.length} — {STEPS[step]}
            </div>
          </div>
          <button className="btn-icon" onClick={onClose}>✕</button>
        </div>

        {/* Progress bar */}
        <div style={{ height: 3, background: '#2d3248', margin: '0 0 4px' }}>
          <div style={{ height: '100%', width: `${((step + 1) / STEPS.length) * 100}%`, background: '#0866FF', transition: 'width 0.3s' }} />
        </div>

        {/* Body */}
        <div className="modal-body" style={{ overflowY: 'auto', flex: 1 }}>
          {error && <div className="alert alert-error" style={{ marginBottom: 14 }}>{error}</div>}

          {/* ── Step 1: Campaign ── */}
          {step === 0 && (
            <div>
              <div style={{ marginBottom: 14 }}>
                <label className="form-label">Campaign Name *</label>
                <input className="form-input" placeholder="e.g. Ramadan Sale 2025" value={campaignName} onChange={e => setCampaignName(e.target.value)} />
              </div>

              <div style={{ marginBottom: 14 }}>
                <label className="form-label">Objective *</label>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {OBJECTIVES.map(o => (
                    <div key={o.value} onClick={() => setObjective(o.value)} style={{
                      ...card, cursor: 'pointer', marginBottom: 0,
                      borderColor: objective === o.value ? '#0866FF' : '#2d3248',
                      background: objective === o.value ? '#0866FF11' : '#1d1d27',
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{ width: 18, height: 18, borderRadius: '50%', border: `2px solid ${objective === o.value ? '#0866FF' : '#8892b0'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                          {objective === o.value && <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#0866FF' }} />}
                        </div>
                        <div>
                          <div style={{ fontWeight: 600, fontSize: 14 }}>{o.label}</div>
                          <div style={s}>{o.desc}</div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
                <div>
                  <label className="form-label">Budget Type</label>
                  <select className="form-input" value={budgetType} onChange={e => setBudgetType(e.target.value)}>
                    <option value="daily">Daily Budget</option>
                    <option value="lifetime">Lifetime Budget</option>
                  </select>
                </div>
                <div>
                  <label className="form-label">Amount (USD) *</label>
                  <input className="form-input" type="number" min="1" step="0.5" placeholder="e.g. 10" value={budgetUsd} onChange={e => setBudgetUsd(e.target.value)} />
                  {budgetUsd && parseFloat(budgetUsd) > 0 && (
                    <div style={{ fontSize: 11, color: '#8892b0', marginTop: 3 }}>≈ {fmt(parseFloat(budgetUsd) * usdRate)} MAD/{budgetType === 'daily' ? 'day' : 'total'}</div>
                  )}
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label className="form-label">Start Date <span style={s}>(optional)</span></label>
                  <input className="form-input" type="datetime-local" value={startTime} onChange={e => setStartTime(e.target.value)} />
                </div>
                <div>
                  <label className="form-label">End Date <span style={s}>(optional)</span></label>
                  <input className="form-input" type="datetime-local" value={endTime} onChange={e => setEndTime(e.target.value)} />
                </div>
              </div>
            </div>
          )}

          {/* ── Step 2: Audience ── */}
          {step === 1 && (
            <div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
                <div>
                  <label className="form-label">Country</label>
                  <select className="form-input" value={country} onChange={e => setCountry(e.target.value)}>
                    {COUNTRIES.map(c => <option key={c.code} value={c.code}>{c.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="form-label">Gender</label>
                  <select className="form-input" value={gender} onChange={e => setGender(e.target.value)}>
                    <option value="all">All Genders</option>
                    <option value="male">Men Only</option>
                    <option value="female">Women Only</option>
                  </select>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
                <div>
                  <label className="form-label">Min Age</label>
                  <input className="form-input" type="number" min="18" max="64" value={ageMin} onChange={e => setAgeMin(parseInt(e.target.value))} />
                </div>
                <div>
                  <label className="form-label">Max Age</label>
                  <input className="form-input" type="number" min="19" max="65" value={ageMax} onChange={e => setAgeMax(parseInt(e.target.value))} />
                </div>
              </div>

              <div>
                <label className="form-label">Interests <span style={s}>(optional)</span></label>
                <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                  <input className="form-input" placeholder="Search interests (e.g. fashion, fitness...)" value={interestSearch}
                    onChange={e => setInterestSearch(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleSearchInterests()}
                    style={{ flex: 1 }} />
                  <button className="btn btn-secondary btn-sm" onClick={handleSearchInterests} disabled={searchingInterests} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <Search size={13} /> {searchingInterests ? '...' : 'Search'}
                  </button>
                </div>

                {interestResults.length > 0 && (
                  <div style={{ background: '#12121a', borderRadius: 8, border: '1px solid #2d3248', marginBottom: 10, maxHeight: 180, overflowY: 'auto' }}>
                    {interestResults.map(i => (
                      <div key={i.id} onClick={() => toggleInterest(i)} style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        padding: '8px 12px', cursor: 'pointer', fontSize: 13,
                        background: selectedInterests.find(x => x.id === i.id) ? '#0866FF11' : 'transparent',
                        borderBottom: '1px solid #2d324833',
                      }}>
                        <span>{i.name}</span>
                        {selectedInterests.find(x => x.id === i.id) && <Check size={14} color="#0866FF" />}
                      </div>
                    ))}
                  </div>
                )}

                {selectedInterests.length > 0 && (
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    {selectedInterests.map(i => (
                      <span key={i.id} style={{ background: '#0866FF22', color: '#60a5fa', borderRadius: 20, padding: '3px 10px', fontSize: 12, display: 'flex', alignItems: 'center', gap: 5 }}>
                        {i.name}
                        <X size={11} style={{ cursor: 'pointer' }} onClick={() => toggleInterest(i)} />
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ── Step 3: Placements ── */}
          {step === 2 && (
            <div>
              <p style={{ ...s, marginBottom: 14 }}>Choose where your ads will appear. You can select multiple placements.</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {PLACEMENTS.map(p => (
                  <div key={p.value} onClick={() => togglePlacement(p.value)} style={{
                    ...card, cursor: 'pointer', marginBottom: 0,
                    borderColor: placements.includes(p.value) ? '#0866FF' : '#2d3248',
                    background: placements.includes(p.value) ? '#0866FF11' : '#1d1d27',
                    display: 'flex', alignItems: 'center', gap: 12,
                  }}>
                    <span style={{ fontSize: 22 }}>{p.icon}</span>
                    <span style={{ fontWeight: 500, flex: 1 }}>{p.label}</span>
                    {placements.includes(p.value) && <Check size={16} color="#0866FF" />}
                  </div>
                ))}
              </div>
              <div style={{ marginTop: 14, padding: '10px 14px', background: '#1d1d27', borderRadius: 8, fontSize: 12, color: '#8892b0' }}>
                💡 For WhatsApp — select any placement above, then choose "Send WhatsApp Message" as the CTA in the next step.
              </div>
            </div>
          )}

          {/* ── Step 4: Creative ── */}
          {step === 3 && (
            <div>
              {/* Page selector */}
              <div style={{ marginBottom: 14 }}>
                <label className="form-label">Facebook Page *</label>
                {pages.length === 0 ? (
                  <div style={{ ...s, padding: '10px 0' }}>Loading pages...</div>
                ) : (
                  <select className="form-input" value={pageId} onChange={e => setPageId(e.target.value)}>
                    <option value="">Select a page</option>
                    {pages.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                )}
              </div>

              {/* Image upload */}
              <div style={{ marginBottom: 14 }}>
                <label className="form-label">Ad Image *</label>
                {imagePreview ? (
                  <div style={{ position: 'relative', display: 'inline-block' }}>
                    <img src={imagePreview} alt="preview" style={{ width: '100%', maxHeight: 200, objectFit: 'cover', borderRadius: 8 }} />
                    {uploadingImage && (
                      <div style={{ position: 'absolute', inset: 0, background: '#00000088', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 8, fontSize: 13, color: '#fff' }}>
                        Uploading to Meta...
                      </div>
                    )}
                    {!uploadingImage && (
                      <button onClick={() => { setImageFile(null); setImagePreview(''); setImageHash(''); }}
                        style={{ position: 'absolute', top: 6, right: 6, background: '#00000099', border: 'none', borderRadius: '50%', padding: 4, cursor: 'pointer', color: '#fff', display: 'flex' }}>
                        <X size={14} />
                      </button>
                    )}
                    {imageHash && <div style={{ fontSize: 11, color: '#00d48f', marginTop: 4 }}>✓ Uploaded to Meta</div>}
                  </div>
                ) : (
                  <div onClick={() => fileRef.current?.click()} style={{
                    border: '2px dashed #2d3248', borderRadius: 10, padding: '32px 16px',
                    textAlign: 'center', cursor: 'pointer', color: '#8892b0', fontSize: 13,
                  }}>
                    <Upload size={24} style={{ margin: '0 auto 8px', display: 'block' }} />
                    Click to upload image (JPG, PNG)
                    <div style={{ fontSize: 11, marginTop: 4 }}>Recommended: 1200×628px for feed, 1080×1920px for stories</div>
                  </div>
                )}
                <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={e => handleImageSelect(e.target.files[0])} />
              </div>

              {/* Headline */}
              <div style={{ marginBottom: 12 }}>
                <label className="form-label">Headline * <span style={s}>({headline.length}/40)</span></label>
                <input className="form-input" placeholder="e.g. Get 50% Off Today Only!" maxLength={40} value={headline} onChange={e => setHeadline(e.target.value)} />
              </div>

              {/* Body */}
              <div style={{ marginBottom: 12 }}>
                <label className="form-label">Ad Text * <span style={s}>({body.length}/125)</span></label>
                <textarea className="form-input" placeholder="Write your ad text here..." maxLength={125} rows={3} value={body} onChange={e => setBody(e.target.value)} style={{ resize: 'vertical' }} />
              </div>

              {/* CTA */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
                <div>
                  <label className="form-label">Call to Action</label>
                  <select className="form-input" value={cta} onChange={e => setCta(e.target.value)}>
                    {CTAS.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                  </select>
                </div>
                <div>
                  {cta === 'WHATSAPP_MESSAGE' ? (
                    <>
                      <label className="form-label">WhatsApp Number *</label>
                      <input className="form-input" placeholder="+212600000000" value={whatsappNumber} onChange={e => setWhatsappNumber(e.target.value)} />
                    </>
                  ) : (
                    <>
                      <label className="form-label">Destination URL *</label>
                      <input className="form-input" placeholder="https://your-store.com" value={url} onChange={e => setUrl(e.target.value)} />
                    </>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ── Step 5: Review ── */}
          {step === 4 && (
            <div>
              <div style={card}>
                <div style={{ fontWeight: 600, marginBottom: 10, color: '#0866FF' }}>Campaign</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, fontSize: 13 }}>
                  <div><span style={s}>Name:</span> {campaignName}</div>
                  <div><span style={s}>Objective:</span> {OBJECTIVES.find(o => o.value === objective)?.label}</div>
                  <div><span style={s}>Budget:</span> ${budgetUsd}/{ budgetType === 'daily' ? 'day' : 'total'} ≈ {fmt(parseFloat(budgetUsd || 0) * usdRate)} MAD</div>
                  <div><span style={s}>Starts:</span> {startTime || 'Immediately'}</div>
                </div>
              </div>

              <div style={card}>
                <div style={{ fontWeight: 600, marginBottom: 10, color: '#0866FF' }}>Audience</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, fontSize: 13 }}>
                  <div><span style={s}>Country:</span> {COUNTRIES.find(c => c.code === country)?.name}</div>
                  <div><span style={s}>Age:</span> {ageMin} – {ageMax}</div>
                  <div><span style={s}>Gender:</span> {gender === 'all' ? 'All' : gender === 'male' ? 'Men' : 'Women'}</div>
                  <div><span style={s}>Interests:</span> {selectedInterests.length > 0 ? selectedInterests.map(i => i.name).join(', ') : 'Broad (none)'}</div>
                </div>
              </div>

              <div style={card}>
                <div style={{ fontWeight: 600, marginBottom: 10, color: '#0866FF' }}>Placements</div>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {placements.map(p => (
                    <span key={p} style={{ background: '#2d3248', borderRadius: 20, padding: '3px 10px', fontSize: 12 }}>
                      {PLACEMENTS.find(x => x.value === p)?.label}
                    </span>
                  ))}
                </div>
              </div>

              <div style={card}>
                <div style={{ fontWeight: 600, marginBottom: 10, color: '#0866FF' }}>Creative</div>
                {imagePreview && <img src={imagePreview} alt="ad" style={{ width: '100%', maxHeight: 160, objectFit: 'cover', borderRadius: 6, marginBottom: 10 }} />}
                <div style={{ fontSize: 13 }}>
                  <div style={{ fontWeight: 600, marginBottom: 4 }}>{headline}</div>
                  <div style={{ ...s, marginBottom: 6 }}>{body}</div>
                  <div><span style={s}>CTA:</span> {CTAS.find(c => c.value === cta)?.label}</div>
                  {cta === 'WHATSAPP_MESSAGE' ? (
                    <div><span style={s}>WhatsApp:</span> {whatsappNumber}</div>
                  ) : (
                    <div><span style={s}>URL:</span> {url}</div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="modal-footer" style={{ justifyContent: 'space-between' }}>
          <button className="btn btn-secondary" onClick={step === 0 ? onClose : prev} disabled={loading}>
            {step === 0 ? 'Cancel' : <><ChevronLeft size={14} /> Back</>}
          </button>
          <div style={{ display: 'flex', gap: 8 }}>
            {step < 4 ? (
              <button className="btn btn-primary" onClick={next} disabled={loading}>
                Next <ChevronRight size={14} />
              </button>
            ) : (
              <>
                <button className="btn btn-secondary" onClick={() => handleLaunch('PAUSED')} disabled={loading}>
                  {loading ? 'Saving...' : 'Save as Draft'}
                </button>
                <button className="btn btn-primary" onClick={() => handleLaunch('ACTIVE')} disabled={loading} style={{ background: '#0866FF' }}>
                  {loading ? 'Launching...' : '🚀 Launch Campaign'}
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
