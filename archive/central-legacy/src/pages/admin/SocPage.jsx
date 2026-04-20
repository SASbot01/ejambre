export default function SocPage() {
  return (
    <div style={{ position: 'fixed', inset: 0, top: 64, background: '#050510', zIndex: 50 }}>
      <iframe
        src="https://soc.blackwolfsec.io"
        style={{ width: '100%', height: '100%', border: 'none', background: '#050510' }}
        allow="clipboard-read; clipboard-write; fullscreen"
      />
    </div>
  )
}
