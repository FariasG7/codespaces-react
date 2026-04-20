import React, { useState, useEffect, useRef, useCallback } from 'react';
import './App.css';

function App() {
  const [texto, setTexto] = useState(localStorage.getItem('diario_texto') || '');
  const [gravando, setGravando] = useState(false);
  const [clima, setClima] = useState('Buscando localização...');
  // Carrega fotos do localStorage se existirem
  const [fotos, setFotos] = useState(() => {
    const saved = localStorage.getItem('diario_fotos');
    return saved ? JSON.parse(saved) : [];
  });
  const [status, setStatus] = useState('Aguardando...');
  
  const recognitionRef = useRef(null);
  const wakeLockRef = useRef(null);

  // --- ADICIONAR FOTO VIA CÂMERA (Compatível com mobile) ---
const selecionarImagem = async (tipo) => {
  const opcoes = { mediaType: 'photo', quality: 1 };
  
  const resultado = tipo === 'camera' 
    ? await launchCamera(opcoes) 
    : await launchImageLibrary(opcoes);

  if (resultado.assets) {
    const uri = resultado.assets[0].uri;
    // Aqui você envia para o estado ou faz o upload para o servidor
    setFotoSelecionada(uri);
  }
};

const botao = document.getElementById('upload-button');
const input = document.getElementById('foto-input');

botao.addEventListener('click', () => {
    input.click(); // Dispara o seletor de arquivos
});

input.addEventListener('change', function() {
    if (this.files && this.files[0]) {
        console.log("Arquivo selecionado:", this.files[0].name);
        // Aqui você pode chamar uma função para mostrar um preview da imagem
    }
});




  // --- OBTENÇÃO DO CLIMA (Envolvido em useCallback para estabilidade) ---
  const buscarClima = useCallback(() => {
    if (!navigator.geolocation) {
      setClima("GPS não suportado");
      return;
    }

    navigator.geolocation.getCurrentPosition(async (pos) => {
      const { latitude, longitude } = pos.coords;
      const API_KEY = "5d69641538ee4295a9ffc578b22ad484"; 

      try {
        const res = await fetch(
          `https://api.openweathermap.org/data/2.5/weather?lat=${latitude}&lon=${longitude}&appid=${API_KEY}&units=metric&lang=pt_br`
        );
        
        if (!res.ok) throw new Error("Erro na API");

        const data = await res.json();
        setClima(`🌡️ ${Math.round(data.main.temp)}°C | ☁️ ${data.weather[0].description}`);
      } catch (error) {
        setClima("Erro ao buscar clima");
      }
    }, () => {
      setClima("Ative o GPS para o clima");
    });
  }, []);

  // --- EFEITO INICIAL ---
  useEffect(() => {
    buscarClima(); // Busca o clima ao iniciar

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognition) {
      const recognition = new SpeechRecognition();
      recognition.lang = 'pt-BR';
      recognition.continuous = true;
      recognition.interimResults = false; // Garante apenas resultados finais

      recognition.onresult = (event) => {
        const transcript = event.results[event.results.length - 1][0].transcript;
        setTexto((prev) => prev + (prev.length > 0 ? ' ' : '') + transcript);
      };

      recognition.onerror = (event) => {
        setStatus(`Erro voz: ${event.error}`);
        setGravando(false);
      };

      recognitionRef.current = recognition;
    } else {
      setStatus('Voz não suportada neste navegador');
    }
  }, [buscarClima]);

  // --- PERSISTÊNCIA ---
  useEffect(() => {
    localStorage.setItem('diario_texto', texto);
  }, [texto]);

  useEffect(() => {
    localStorage.setItem('diario_fotos', JSON.stringify(fotos));
  }, [fotos]);

  const alternarGravacao = async () => {
    if (!recognitionRef.current) {
      setStatus('Reconhecimento de voz indisponível.');
      return;
    }

    if (!gravando) {
      try {
        if ('wakeLock' in navigator) {
          wakeLockRef.current = await navigator.wakeLock.request('screen');
        }
        recognitionRef.current.start();
        setGravando(true);
        setStatus('🟢 Gravando...');
      } catch (err) { 
        setStatus('Erro: ' + err.message); 
      }
    } else {
      recognitionRef.current.stop();
      if (wakeLockRef.current) { 
        wakeLockRef.current.release(); 
        wakeLockRef.current = null; 
      }
      setGravando(false);
      setStatus('✅ Texto guardado.');
    }
  };

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

  const limparTudo = () => {
    if(window.confirm("Deseja apagar todo o relato e fotos?")) {
      setTexto('');
      setFotos([]);
      localStorage.clear();
      setStatus('Aguardando...');
    }
  };

  return (
    <div className="container">
      <header className="header">
        <h1>🏗️ ObraVoz</h1>
        <div className="clima-badge">{clima}</div>
      </header>

      <main className="content">
        <div className="card">
          <div className="info-topo">
            <span>📅 {new Date().toLocaleDateString('pt-BR')}</span>
            <button onClick={limparTudo} className="btn-limpar">Limpar</button>
          </div>
          
          <textarea
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            placeholder="Relate a execução da obra..."
            className="textarea"
          />
          
          <div className="acoes">
            <button 
              onClick={alternarGravacao} 
              className={`btn-main ${gravando ? 'btn-stop' : 'btn-start'}`}
            >
              {gravando ? '🛑 Parar Gravação' : '🎤 Gravar Voz'}
            </button>

            <label htmlFor="input-foto" className="btn-foto">
              📷 Foto
            </label>
            <input 
              id="input-foto" 
              type="file" 
              accept="image/*" 
              capture="environment" 
              onChange={tirarFoto} 
              style={{ display: 'none' }} 
            />
          </div>

          <p className={`status-label ${gravando ? 'pulsar' : ''}`}>{status}</p>

          <div className="galeria">
            {fotos.map((foto, index) => (
              <div key={index} className="foto-container">
                <img src={foto} className="foto-preview" alt={`Obra ${index}`} />
              </div>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}

export default App;
