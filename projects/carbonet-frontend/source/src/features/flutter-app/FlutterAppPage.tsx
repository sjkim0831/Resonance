export default function FlutterAppPage() {
  return (
    <div style={{ width: '100%', height: '100vh', margin: 0, padding: 0 }}>
      <iframe
        src="http://127.0.0.1:8080/flutter-app"
        title="Flutter App"
        style={{ width: '100%', height: '100%', border: 'none' }}
        allow="camera; microphone; geolocation; file-access"
      />
    </div>
  );
}