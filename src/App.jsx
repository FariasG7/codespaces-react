import { jsPDF } from "jspdf";
import React, { useState, useEffect, useRef, useCallback } from 'react';
import './App.css';
import { FaMicrophone, FaCamera, FaPaperclip } from 'react-icons/fa';

function App() {
  // --- ESTADO DE AUTENTICAÇÃO ---
  const [logado, setLogado] = useState(false);
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');

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

  // --- FUNÇÃO DE LOGIN ---
  const manipularLogin = (e) => {
    e.preventDefault();
    // Aqui você pode adicionar sua lógica de validação (Firebase, API, etc)
    if (email !== "" && senha !== "") {
      setLogado(true);
    } else {
      alert("Preencha os campos para entrar.");
    }
  };

  // --- RESTANTE DAS SUAS FUNÇÕES (buscarClima, alternarGravacao, PDF...) ---
  // [Mantenha as funções adicionarLinhaCofragem, adicionarLinhaBetao, buscarClima, etc., como estavam]
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
    if(logado) buscarClima(); // Só busca clima se logar
  }, [buscarClima, logado]);

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

  const finalizarEGerarPDF = () => {
    if(!texto && fotos.length ===0){
      alert("O diário está vazio!");
      return;
    }
    try {
      const doc = new jsPDF();
      const larguraPagina = doc.internal.pageSize.getWidth();
      doc.setFont("helvetica", "bold");
      doc.text("RELATÓRIO DIÁRIO DE OBRA", 105, 20, { align: "center" });
      doc.setFillColor(0,122,255);
      doc.rect(0,0,larguraPagina,40,'F');

      doc.setTextColor(255,255,255);
      doc.setFontSize(22);
      doc.setFont("helvetica", "normal");
      const climaLimpo = clima.replace(/[^\x00-\x7F]/g, "").trim();
      doc.text(`Data: ${new Date().toLocaleDateString('pt-BR')}`, 190, 35, { align: "right" });
      doc.text(`Clima: ${climaLimpo}`, 20, 35);
      doc.line(20, 40, 190, 40);
      doc.setFontSize(12);
      doc.text("Relato da Execução:", 20, 50);
      const splitTexto = doc.splitTextToSize(texto || "Nenhum relato informado.", 170);
      doc.text(splitTexto, 20, 60);
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

// --- TELA DE LOGIN ---
if (!logado) {
  return (
    <div className="login-container">
      <div className="login-box">
        <h1>🏗️ ObraVoz</h1>
        <form className="login-form" onSubmit={manipularLogin}>
          <input 
            type="email" 
            className="login-input" 
            placeholder="E-mail" 
            required 
            onChange={(e) => setEmail(e.target.value)}
          />
          <input 
            type="password" 
            className="login-input" 
            placeholder="Senha" 
            required 
            onChange={(e) => setSenha(e.target.value)}
          />
          <button type="submit" className="btn-login">Entrar</button>
        </form>
        <div className="login-footer">
          Acesso restrito a colaboradores
        </div>
      </div>
    </div>
  );
}


  // --- TELA PRINCIPAL (SÓ APARECE SE LOGADO) ---
  return (
    <div className="container">
      <header className="header">
        <h1>🏗️ ObraVoz</h1>
        <div className="clima-badge">{clima}</div>
      </header>

      <main className="content">
        <div className="card">
          <textarea value={texto} onChange={(e) => setTexto(e.target.value)} placeholder="Relato de execução..." className="textarea" />

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
            <button onClick={() => setLogado(false)} style={{marginTop: '10px', background: 'none', color: '#888', border: 'none'}}>Sair</button>
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
