import React, { useState, useEffect, useRef } from 'react';
import './App.css';

function App() {
  const [texto, setTexto] = useState('');
  const [gravando, setGravando] = useState(false);
  const [clima, setClima] = useState('Carregando clima...');
  const [status, setStatus] = useState('Aguardando comando...');
  const recognitionRef = useRef(null);
  const wakeLockRef = useRef(null);

// 1. Adicione um novo estado para as fotos no topo do componente
const [fotos, setFotos] = useState([]);

// 2. Função para capturar a imagem
const tirarFoto = (e) => {
  const arquivo = e.target.files[0];
  if (arquivo) {
    const reader = new FileReader();
    reader.onloadend = () => {
      setFotos((prev) => [...prev, reader.result]);
    };
    reader.readAsDataURL(arquivo);
  }
};



  // --- NOVA FUNÇÃO DE CLIMA ---
  const buscarClima = () => {
    if (!navigator.geolocation) {
      setClima("GPS não suportado");
      return;
    }

    navigator.geolocation.getCurrentPosition(async (pos) => {
      const { latitude, longitude } = pos.coords;
      try {
        // Exemplo de chamada (Substitua YOUR_API_KEY pela sua chave depois)
        // Por enquanto, vamos simular a resposta para você ver o visual
        const API_KEY = "SUA_CHAVE_AQUI"; 
        if(API_KEY === "SUA_CHAVE_AQUI") {
           setClima("📍 Localização capturada (Insira a API Key)");
           return;
        }

        const res = await fetch(`https://api.openweathermap.org/data/2.5/weather?lat=${latitude}&lon=${longitude}&appid=${API_KEY}&units=metric&lang=pt_br`);
        const data = await res.json();
        setClima(`🌡️ ${data.main.temp}°C | ☁️ ${data.weather[0].description}`);
      } catch (error) {
        setClima("Erro ao buscar clima");
      }
    });
  };
<h2>clima</h2>
  useEffect(() => {
    buscarClima(); // Busca o clima ao abrir o app

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognition) {
      const recognition = new SpeechRecognition();
      recognition.lang = 'pt-BR';
      recognition.continuous = true;
      recognition.onresult = (event) => {
        const transcript = event.results[event.results.length - 1][0].transcript;
        setTexto((prev) => prev + transcript + '\n');
      };
      recognitionRef.current = recognition;
    }
  }, []);

  const alternarGravacao = async () => {
    if (!gravando) {
      try {
        if ('wakeLock' in navigator) wakeLockRef.current = await navigator.wakeLock.request('screen');
        recognitionRef.current.start();
        setGravando(true);
        setStatus('🟢 Ouvindo...');
      } catch (err) { setStatus('Erro: ' + err.message); }
    } else {
      recognitionRef.current.stop();
      if (wakeLockRef.current) { wakeLockRef.current.release(); wakeLockRef.current = null; }
      setGravando(false);
      setStatus('✅ Gravado.');
    }
  };

  return (
    <div className="container">
      <header className="header">
        <h1>🏗️ Diário de Obra</h1>
        <div className="clima-badge">{clima}</div>
      </header>

      <main className="content">
        <div className="card">
          <div className="info-topo">
            <span>📅 {new Date().toLocaleDateString('pt-BR')}</span>
          </div>
          
          <textarea
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            placeholder="Relate a execução de hoje..."
            className="textarea"
          />
          
          <button 
            onClick={alternarGravacao} 
            className={`btn-main ${gravando ? 'btn-stop' : 'btn-start'}`}
          >
            {gravando ? '🛑 Parar Gravador' : '🎤 Falar Agora'}
          </button>
          <p className="status-label">{status}</p>
        </div>
      </main>
    </div>
  );
}

export default App;
