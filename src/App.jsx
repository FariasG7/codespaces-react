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
  try {
    const doc = new jsPDF();
    const larguraPagina = doc.internal.pageSize.getWidth();
    setStatus("⏳ Gerando PDF detalhado...");

    // --- 1. CABEÇALHO ---
    doc.setFillColor(0, 122, 255); 
    doc.rect(0, 0, larguraPagina, 40, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(22);
    doc.text("RELATÓRIO DIÁRIO DE OBRA", 15, 25);
    doc.setFontSize(10);
    doc.text(`Data: ${new Date().toLocaleDateString('pt-BR')} | Clima: ${clima.replace(/[^\x00-\x7F]/g, "")}`, 15, 33);

    // --- 2. RELATO ---
    doc.setTextColor(40, 40, 40);
    doc.setFontSize(14);
    doc.text("Relato da Execução:", 15, 55);
    doc.setFontSize(11);
    const textoQuebrado = doc.splitTextToSize(texto || "Nenhum relato.", larguraPagina - 30);
    doc.text(textoQuebrado, 15, 65);

    let yPos = 65 + (textoQuebrado.length * 8) + 10;

    // --- 3. TABELA DETALHADA DE COFRAGEM ---
    doc.setFontSize(14);
    doc.setTextColor(0, 122, 255);
    doc.text("Detalhamento de Cofragem", 15, yPos);
    yPos += 8;

    // Cabeçalho da Tabela
    doc.setFontSize(10);
    doc.setFillColor(240, 240, 240);
    doc.rect(15, yPos, larguraPagina - 30, 8, 'F');
    doc.setTextColor(0);
    doc.text("Peça", 20, yPos + 6);
    doc.text("L (m)", 70, yPos + 6);
    doc.text("A (m)", 100, yPos + 6);
    doc.text("C (m)", 130, yPos + 6);
    doc.text("Subtotal", 170, yPos + 6);
    yPos += 12;

    let totalCof = 0;
    doc.setFontSize(9);
    linhasCofragem.forEach((l) => {
      const L = parseFloat(l.largura) || 0;
      const A = parseFloat(l.altura) || 0;
      const C = parseFloat(l.comprimento) || 0;
      let subtotal = 0;

      if (A > 0 && L > 0 && C > 0) subtotal = (2 * L + 2 * A) * C; // Pilar
      else if (L > 0 && C > 0) subtotal = L * C; // Laje

      totalCof += subtotal;

      if(subtotal > 0) { // Só lista se houver cálculo
        doc.text(l.peca || "Sem nome", 20, yPos);
        doc.text(L.toFixed(2), 70, yPos);
        doc.text(A.toFixed(2), 100, yPos);
        doc.text(C.toFixed(2), 130, yPos);
        doc.text(subtotal.toFixed(2) + " m2", 170, yPos);
        yPos += 7;
      }
    });

    yPos += 5;
    doc.setFont("helvetica", "bold");
    doc.text(`Total Cofragem: ${totalCof.toFixed(2)} m2`, 170, yPos, { align: 'right' });
    doc.setFont("helvetica", "normal");

    // --- 4. TABELA DETALHADA DE BETÃO ---
    yPos += 15;
    if (yPos > 250) { doc.addPage(); yPos = 20; }
    
    doc.setFontSize(14);
    doc.setTextColor(0, 122, 255);
    doc.text("Detalhamento de Betão", 15, yPos);
    yPos += 8;

    doc.setFillColor(240, 240, 240);
    doc.rect(15, yPos, larguraPagina - 30, 8, 'F');
    doc.setTextColor(0);
    doc.setFontSize(10);
    doc.text("Elemento", 20, yPos + 6);
    doc.text("L (m)", 70, yPos + 6);
    doc.text("A (m)", 100, yPos + 6);
    doc.text("C (m)", 130, yPos + 6);
    doc.text("Volume", 170, yPos + 6);
    yPos += 12;

    let totalBet = 0;
    doc.setFontSize(9);
    linhasBetao.forEach((l) => {
      const subtotal = (parseFloat(l.largura) || 0) * (parseFloat(l.altura) || 0) * (parseFloat(l.comprimento) || 0);
      totalBet += subtotal;

      if(subtotal > 0) {
        doc.text(l.elemento || "Sem nome", 20, yPos);
        doc.text((parseFloat(l.largura) || 0).toFixed(2), 70, yPos);
        doc.text((parseFloat(l.altura) || 0).toFixed(2), 100, yPos);
        doc.text((parseFloat(l.comprimento) || 0).toFixed(2), 130, yPos);
        doc.text(subtotal.toFixed(2) + " m3", 170, yPos);
        yPos += 7;
      }
    });

    yPos += 5;
    doc.setFont("helvetica", "bold");
    doc.text(`Total Betão: ${totalBet.toFixed(2)} m3`, 170, yPos, { align: 'right' });

    // --- 5. FOTOS (Numa nova página) ---
    if (fotos.length > 0) {
      doc.addPage();
      doc.setTextColor(0, 122, 255);
      doc.setFontSize(14);
      doc.text("Anexos Fotográficos", 15, 20);
      let xImg = 15; let yImg = 30;
      fotos.forEach((foto, index) => {
        if (yImg > 230) { doc.addPage(); yImg = 20; }
        doc.addImage(foto, 'JPEG', xImg, yImg, 85, 65);
        xImg === 15 ? xImg = 110 : (xImg = 15, yImg += 80);
      });
    }

    doc.save(`Diario_Obra_${new Date().toLocaleDateString('pt-BR').replace(/\//g, '-')}.pdf`);
    setStatus("✅ PDF Detalhado Gerado!");

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
  <p style={{fontSize: '10px', color: '#888'}}>Laje: L x C | Pilar: (2L + 2A) x C</p>
  <table style={{ width: '100%' }}>
    <thead>
      <tr>
        <th>Peça</th>
        <th>L (m)</th>
        <th>A (m)</th>
        <th>C (m)</th>
      </tr>
    </thead>
    <tbody>
      {linhasCofragem.map((linha, i) => (
        <tr key={i}>
          <td><input className="input-tabela" placeholder="Ex: Laje" value={linha.peca} onChange={e => atualizarCampo(i, 'cofragem', 'peca', e.target.value)} /></td>
          <td><input className="input-tabela" type="number" placeholder="0.00" value={linha.largura} onChange={e => atualizarCampo(i, 'cofragem', 'largura', e.target.value)} /></td>
          <td><input className="input-tabela" type="number" placeholder="0.00" value={linha.altura} onChange={e => atualizarCampo(i, 'cofragem', 'altura', e.target.value)} /></td>
          <td><input className="input-tabela" type="number" placeholder="0.00" value={linha.comprimento} onChange={e => atualizarCampo(i, 'cofragem', 'comprimento', e.target.value)} /></td>
        </tr>
      ))}
    </tbody>
  </table>
  <button onClick={adicionarLinhaCofragem} className="btn-add">+ Linha</button>

  <h3 style={{ marginTop: '15px' }}>🧊 Cubicagem Betão (m³)</h3>
  <table style={{ width: '100%' }}>
    <thead>
      <tr>
        <th>Elemento</th>
        <th>L</th>
        <th>A</th>
        <th>C</th>
      </tr>
    </thead>
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
