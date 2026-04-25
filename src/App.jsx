import { jsPDF } from "jspdf";
import React, { useState, useEffect, useRef, useCallback } from 'react';
import './App.css';
import { FaMicrophone, FaCamera, FaPaperclip } from 'react-icons/fa';

function App() {
  const [texto, setTexto] = useState(() => localStorage.getItem('diario_texto') || '');
  const [gravando, setGravando] = useState(false);
  const [clima, setClima] = useState('Buscando localização...');
  const [fotos, setFotos] = useState(() => {
    const saved = localStorage.getItem('diario_fotos');
    return saved ? JSON.parse(saved) : [];
  });
  const [status, setStatus] = useState('Aguardando...');

  // Estados para as tabelas
  const [linhasCofragem, setLinhasCofragem] = useState([{ peca: '', largura: '', altura: '', comprimento: '' }]);
  const [linhasBetao, setLinhasBetao] = useState([{ elemento: '', largura: '', altura: '', comprimento: '' }]);

  const recognitionRef = useRef(null);
  const wakeLockRef = useRef(null);

  // --- FUNÇÕES DE MANIPULAÇÃO DAS TABELAS ---
  const adicionarLinhaCofragem = () => setLinhasCofragem([...linhasCofragem, { peca: '', largura: '', altura: '', comprimento: '' }]);
  const adicionarLinhaBetao = () => setLinhasBetao([...linhasBetao, { elemento: '', largura: '', altura: '', comprimento: '' }]);

  const atualizarCampo = (index, tabela, campo, valor) => {
    if (tabela === 'cofragem') {
      const novas = [...linhasCofragem];
      novas[index][campo] = valor;
      setLinhasCofragem(novas);
    } else {
      const novas = [...linhasBetao];
      novas[index][campo] = valor;
      setLinhasBetao(novas);
    }
  };

  // --- BUSCA DE CLIMA ---
  const buscarClima = useCallback(async () => {
    if (!navigator.geolocation) return setClima("GPS não suportado");
    navigator.geolocation.getCurrentPosition(async (pos) => {
      const { latitude, longitude } = pos.coords;
      const API_KEY = "5d69641538ee4295a9ffc578b22ad484";
      try {
        const res = await fetch(`https://api.openweathermap.org/data/2.5/weather?lat=${latitude}&lon=${longitude}&appid=${API_KEY}&units=metric&lang=pt_br`);
        if (!res.ok) throw new Error();
        const data = await res.json();
        const iconesClima = { Clear: "☀️", Clouds: "☁️", Rain: "🌧️", Thunderstorm: "⛈️", Snow: "❄️", Drizzle: "🌦️", Mist: "🌫️", Default: "🌡️" };
        const condicao = data.weather[0].main;
        const icone = iconesClima[condicao] || iconesClima.Default;
        setClima(`${icone} ${Math.round(data.main.temp)}°C | ${data.weather[0].description}`);
      } catch { setClima("Clima indisponível"); }
    }, () => setClima("GPS desligado"));
  }, []);

  // --- RECOGNITION ---
  useEffect(() => {
    const Speech = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (Speech) {
      const recognition = new Speech();
      recognition.lang = 'pt-BR';
      recognition.continuous = true;
      recognition.onresult = (event) => {
        const transcript = event.results[event.results.length - 1][0].transcript;
        setTexto((prev) => prev + (prev.length > 0 ? ' ' : '') + transcript);
      };
      recognition.onend = () => setGravando(false);
      recognitionRef.current = recognition;
    }
    buscarClima();
  }, [buscarClima]);

  // --- PERSISTÊNCIA ---
  useEffect(() => { localStorage.setItem('diario_texto', texto); }, [texto]);
  useEffect(() => { localStorage.setItem('diario_fotos', JSON.stringify(fotos)); }, [fotos]);

  const alternarGravacao = async () => {
    if (!recognitionRef.current) return;
    if (!gravando) {
      try {
        if ('wakeLock' in navigator) wakeLockRef.current = await navigator.wakeLock.request('screen');
        recognitionRef.current.start();
        setGravando(true);
        setStatus('🟢 Gravando...');
      } catch (err) { setStatus('Erro ao iniciar'); }
    } else {
      recognitionRef.current.stop();
      wakeLockRef.current?.release();
      setGravando(false);
      setStatus('✅ Salvo.');
    }
  };

  const handleFoto = (e) => {
    const arquivo = e.target.files[0];
    if (!arquivo) return;
    const reader = new FileReader();
    reader.onloadend = () => setFotos((prev) => [...prev, reader.result]);
    reader.readAsDataURL(arquivo);
  };

  // --- GERAR PDF ---
  const finalizarEGerarPDF = () => {
    try {
      const doc = new jsPDF();
      doc.setFont("helvetica", "bold");
      doc.text("RELATÓRIO DIÁRIO DE OBRA", 105, 20, { align: "center" });

      doc.setFontSize(10);
      doc.setFont("helvetica", "normal");
      const climaLimpo = clima.replace(/[^\x00-\x7F]/g, "").trim();
      doc.text(`Data: ${new Date().toLocaleDateString('pt-BR')}`, 190, 35, { align: "right" });
      doc.text(`Clima: ${climaLimpo}`, 20, 35);

      doc.line(20, 40, 190, 40);

      doc.setFontSize(12);
      doc.text("Relato da Execução:", 20, 50);
      const splitTexto = doc.splitTextToSize(texto || "Nenhum relato informado.", 170);
      doc.text(splitTexto, 20, 60);

      // Cálculos
      let totalCofragem = 0;
      linhasCofragem.forEach(l => totalCofragem += (Number(l.largura) || 0) * (Number(l.altura) || 0) * (Number(l.comprimento) || 0));
      
      let totalBetao = 0;
      linhasBetao.forEach(l => totalBetao += (Number(l.largura) || 0) * (Number(l.altura) || 0) * (Number(l.comprimento) || 0));

      let yPosCalculos = 100;
      doc.setFont("helvetica", "bold");
      doc.text("Resumo de Quantidades:", 20, yPosCalculos);
      doc.setFont("helvetica", "normal");
      doc.text(`Total Cofragem Estimada: ${totalCofragem.toFixed(2)} m2`, 20, yPosCalculos + 10);
      doc.text(`Total Betão Estimado: ${totalBetao.toFixed(2)} m3`, 20, yPosCalculos + 20);

      if (fotos.length > 0) {
        doc.addPage();
        doc.text("Anexos Fotográficos:", 20, 20);
        fotos.forEach((foto, index) => {
          const yImg = 30 + (index * 70);
          if (yImg < 250) doc.addImage(foto, 'JPEG', 20, yImg, 80, 60);
        });
      }

      doc.save(`relatorio_${new Date().getTime()}.pdf`);
      setStatus("✅ PDF Gerado!");
    } catch (error) {
      console.error(error);
      setStatus("❌ Erro ao gerar PDF");
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
          <textarea value={texto} onChange={(e) => setTexto(e.target.value)} placeholder="Relato de execução..." className="textarea" />

          {/* TABELAS FORA DA DIV ACOES */}
          <div className="card-tabelas" style={{ padding: '0 20px', color: '#fff' }}>
            <h3>📐 Cofragem (m²)</h3>
            <table style={{ width: '100%' }}>
              <thead><tr><th>Peça</th><th>L</th><th>A</th><th>C</th></tr></thead>
              <tbody>
                {linhasCofragem.map((linha, i) => (
                  <tr key={i}>
                    <td><input className="input-tabela" value={linha.peca} onChange={e => atualizarCampo(i, 'cofragem', 'peca', e.target.value)} /></td>
                    <td><input className="input-tabela" type="number" value={linha.largura} onChange={e => atualizarCampo(i, 'cofragem', 'largura', e.target.value)} /></td>
                    <td><input className="input-tabela" type="number" value={linha.altura} onChange={e => atualizarCampo(i, 'cofragem', 'altura', e.target.value)} /></td>
                    <td><input className="input-tabela" type="number" value={linha.comprimento} onChange={e => atualizarCampo(i, 'cofragem', 'comprimento', e.target.value)} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
            <button onClick={adicionarLinhaCofragem} className="btn-add">+ Linha</button>

            <h3 style={{ marginTop: '15px' }}>🧊 Cubicagem Betão (m³)</h3>
            <table style={{ width: '100%' }}>
              <thead><tr><th>Peça</th><th>L</th><th>A</th><th>C</th></tr></thead>
              <tbody>
                {linhasBetao.map((linha, i) => (
                  <tr key={i}>
                    <td><input className="input-tabela" value={linha.elemento} onChange={e => atualizarCampo(i, 'betao', 'elemento', e.target.value)} /></td>
                    <td><input className="input-tabela" type="number" value={linha.largura} onChange={e => atualizarCampo(i, 'betao', 'largura', e.target.value)} /></td>
                    <td><input className="input-tabela" type="number" value={linha.altura} onChange={e => atualizarCampo(i, 'betao', 'altura', e.target.value)} /></td>
                    <td><input className="input-tabela" type="number" value={linha.comprimento} onChange={e => atualizarCampo(i, 'betao', 'comprimento', e.target.value)} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
            <button onClick={adicionarLinhaBetao} className="btn-add">+ Linha</button>
          </div>

          {/* BOTÕES DE AÇÃO (LADO A LADO) */}
          <div className="acoes" style={{ display: 'flex', justifyContent: 'center', gap: '20px', padding: '20px' }}>
            <button onClick={alternarGravacao} className={`icon icon-fill ${gravando ? 'active' : ''}`}>
              <i>{gravando ? <FaMicrophone style={{ color: 'red' }} /> : <FaMicrophone />}</i>
            </button>
            <label className="icon icon-enter">
              <i><FaCamera /></i>
              <input type="file" accept="image/*" capture="environment" onChange={handleFoto} hidden />
            </label>
            <label htmlFor="upload-button" className="icon icon-expand">
              <i><FaPaperclip /></i>
              <input type="file" accept="image/*" multiple onChange={handleFoto} id="upload-button" hidden />
            </label>
          </div>

          <div className="acoes-finalizacao">
            <button onClick={finalizarEGerarPDF} className="btn-finalizar">📂 Gerar PDF</button>
          </div>
          <p className="status-label">{status}</p>
          <div className="galeria">
            {fotos.map((foto, i) => <img key={i} src={foto} className="foto-preview" alt="Obra" />)}
          </div>
        </div>
      </main>
    </div>
  );
}
export default App;
