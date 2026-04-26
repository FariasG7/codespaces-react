import React, { useState, useEffect, useRef, useCallback } from 'react';
import { jsPDF } from "jspdf"; 
import './App.css';
import { FaMicrophone, FaCamera, FaPaperclip, FaRegFilePdf } from 'react-icons/fa';

const USUARIO_TEMP = {
  email: "obra@teste.com",
  senha: "123"
};

function App() {
  // --- 1. ESTADOS DE AUTENTICAÇÃO ---
  const [logado, setLogado] = useState(() => localStorage.getItem('app_logado') === 'true');
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');

  // --- 2. ESTADOS DE DADOS (COM TRATAMENTO DE ERRO NO PARSE) ---
  const [texto, setTexto] = useState(() => localStorage.getItem('diario_texto') || '');
  
  const [fotos, setFotos] = useState(() => {
    try {
      const saved = localStorage.getItem('diario_fotos');
      return saved ? JSON.parse(saved) : [];
    } catch (e) { return []; }
  });
  
  const [linhasCofragem, setLinhasCofragem] = useState(() => {
    try {
      const saved = localStorage.getItem('diario_cofragem');
      return saved ? JSON.parse(saved) : [{ peca: '', largura: '', altura: '', comprimento: '' }];
    } catch (e) { return [{ peca: '', largura: '', altura: '', comprimento: '' }]; }
  });

  const [linhasBetao, setLinhasBetao] = useState(() => {
    try {
      const saved = localStorage.getItem('diario_betao');
      return saved ? JSON.parse(saved) : [{ elemento: '', largura: '', altura: '', comprimento: '' }];
    } catch (e) { return [{ elemento: '', largura: '', altura: '', comprimento: '' }]; }
  });

  const [status, setStatus] = useState('Aguardando...');
  const [gravando, setGravando] = useState(false);
  const [clima, setClima] = useState('Buscando localização...');

  // --- 3. REFS ---
  const recognitionRef = useRef(null);
  const wakeLockRef = useRef(null);

  // --- 4. EFEITOS DE PERSISTÊNCIA ---
  useEffect(() => {
    localStorage.setItem('app_logado', logado);
    if (logado) {
      localStorage.setItem('diario_texto', texto);
      localStorage.setItem('diario_fotos', JSON.stringify(fotos));
      localStorage.setItem('diario_cofragem', JSON.stringify(linhasCofragem));
      localStorage.setItem('diario_betao', JSON.stringify(linhasBetao));
    }
  }, [logado, texto, fotos, linhasCofragem, linhasBetao]);

  // --- 5. FUNÇÕES DE SUPORTE ---
  const limparDadosDiario = () => {
    setTexto('');
    setFotos([]);
    setLinhasCofragem([{ peca: '', largura: '', altura: '', comprimento: '' }]);
    setLinhasBetao([{ elemento: '', largura: '', altura: '', comprimento: '' }]);
    localStorage.removeItem('diario_texto');
    localStorage.removeItem('diario_fotos');
    localStorage.removeItem('diario_cofragem');
    localStorage.removeItem('diario_betao');
    setStatus('Aguardando...');
  };

  const manipularLogin = (e) => {
    e.preventDefault();
    if (email === USUARIO_TEMP.email && senha === USUARIO_TEMP.senha) {
      setLogado(true);
      setStatus("Bem-vindo!");
    } else {
      alert("E-mail ou senha incorretos.");
    }
  };

  const buscarClima = useCallback(async () => {
    if (!navigator.geolocation) return setClima("GPS não suportado");
    navigator.geolocation.getCurrentPosition(async (pos) => {
      const { latitude, longitude } = pos.coords;
      try {
        const res = await fetch(`https://api.openweathermap.org/data/2.5/weather?lat=${latitude}&lon=${longitude}&appid=5d69641538ee4295a9ffc578b22ad484&units=metric&lang=pt_br`);
        const data = await res.json();
        setClima(`🌡️ ${Math.round(data.main.temp)}°C | ${data.weather[0].description}`);
      } catch { setClima("Clima indisponível"); }
    });
  }, []);

  useEffect(() => {
    const Speech = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (Speech && !recognitionRef.current) {
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
    if(logado) buscarClima();
  }, [buscarClima, logado]);

  const alternarGravacao = async () => {
    if (!recognitionRef.current) return;
    if (!gravando) {
      try {
        if ('wakeLock' in navigator) wakeLockRef.current = await navigator.wakeLock.request('screen');
        recognitionRef.current.start();
        setGravando(true);
        setStatus('🟢 Gravando...');
      } catch { setStatus('Erro ao iniciar'); }
    } else {
      recognitionRef.current.stop();
      wakeLockRef.current?.release();
      setGravando(false);
      setStatus('✅ Salvo.');
    }
  };

  const handleFoto = (e) => {
    const arquivos = Array.from(e.target.files);
    arquivos.forEach(arquivo => {
      const reader = new FileReader();
      reader.onloadend = () => setFotos((prev) => [...prev, reader.result]);
      reader.readAsDataURL(arquivo);
    });
  };

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

  const finalizarEGerarPDF = () => {
  try {
    const doc = new jsPDF();
    const larguraPagina = doc.internal.pageSize.getWidth();
    setStatus("⏳ Gerando PDF completo...");

    // --- 1. CABEÇALHO ---
    doc.setFillColor(0, 122, 255); 
    doc.rect(0, 0, larguraPagina, 40, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(22);
    doc.text("RELATÓRIO DIÁRIO DE OBRA", 15, 25);
    doc.setFontSize(10);
    doc.text(`Data: ${new Date().toLocaleDateString('pt-BR')} | Clima: ${clima}`, 15, 33);

    // --- 2. RELATO ---
    doc.setTextColor(40, 40, 40);
    doc.setFontSize(14);
    doc.text("Relato da Execução:", 15, 55);
    doc.setFontSize(11);
    const textoQuebrado = doc.splitTextToSize(texto || "Nenhum relato.", larguraPagina - 30);
    doc.text(textoQuebrado, 15, 65);

    let yPos = 65 + (textoQuebrado.length * 7) + 10;

    // --- 3. TABELA DE MEDIÇÕES (COFRAGEM) ---
    if (yPos > 240) { doc.addPage(); yPos = 20; }
    doc.setFontSize(14);
    doc.setTextColor(0, 122, 255);
    doc.text("Medições de Cofragem", 15, yPos);
    yPos += 10;

    doc.setFontSize(10);
    doc.setTextColor(0);
    linhasCofragem.forEach((l) => {
      if (l.peca && (l.largura || l.comprimento)) {
        const L = parseFloat(l.largura) || 0;
        const A = parseFloat(l.altura) || 0;
        const C = parseFloat(l.comprimento) || 0;
        // Lógica: Pilar (2L + 2A) * C ou Laje L * C
        const subtotal = A > 0 ? (2 * L + 2 * A) * C : L * C;
        doc.text(`• ${l.peca}: ${subtotal.toFixed(2)} m²`, 20, yPos);
        yPos += 7;
        if (yPos > 280) { doc.addPage(); yPos = 20; }
      }
    });

    // --- 4. ANEXOS FOTOGRÁFICOS ---
    if (fotos.length > 0) {
      doc.addPage();
      doc.setTextColor(0, 122, 255);
      doc.setFontSize(14);
      doc.text("Anexos Fotográficos", 15, 20);
      let xImg = 15;
      let yImg = 30;
      
      fotos.forEach((foto) => {
        if (yImg > 230) { doc.addPage(); yImg = 20; xImg = 15; }
        doc.addImage(foto, 'JPEG', xImg, yImg, 85, 65);
        // Organiza em duas colunas
        xImg === 15 ? xImg = 110 : (xImg = 15, yImg += 75);
      });
    }

    // --- 5. SALVAMENTO ---
    doc.save(`Diario_Obra_${new Date().toLocaleDateString('pt-BR').replace(/\//g, '-')}.pdf`);
    setStatus("✅ PDF Gerado com Sucesso!");

  } catch (error) {
    console.error(error);
    setStatus("❌ Erro ao gerar PDF");
  }
};



  // --- 6. RENDERIZAÇÃO ---
  if (!logado) {
    return (
      <div className="login-container">
        <div className="login-box">
          <h1>🏗️ ObraVoz</h1>
          <form className="login-form" onSubmit={manipularLogin}>
            <input className="login-input" placeholder="E-mail" onChange={e => setEmail(e.target.value)} required />
            <input className="login-input" type="password" placeholder="Senha" onChange={e => setSenha(e.target.value)} required />
            <button type="submit" className="btn-login">Entrar</button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="container">
      <header className="header">
        <h1>🏗️ ObraVoz</h1>
        <div className="clima-badge">{clima}</div>
      </header>
      <main className="content">
        <div className="card">
          <textarea value={texto} onChange={(e) => setTexto(e.target.value)} placeholder="Fale ou digite o relato..." className="textarea" />
          
          <div className="card-tabelas">
            <h3>📐 Cofragem (m²)</h3>
            <table>
              <tbody>
                {linhasCofragem.map((l, i) => (
                  <tr key={i}>
                    <td><input className="input-tabela" placeholder="Peça" value={l.peca} onChange={e => atualizarCampo(i, 'cofragem', 'peca', e.target.value)} /></td>
                    <td><input className="input-tabela" type="number" placeholder="L" value={l.largura} onChange={e => atualizarCampo(i, 'cofragem', 'largura', e.target.value)} /></td>
                    <td><input className="input-tabela" type="number" placeholder="A" value={l.altura} onChange={e => atualizarCampo(i, 'cofragem', 'altura', e.target.value)} /></td>
                    <td><input className="input-tabela" type="number" placeholder="C" value={l.comprimento} onChange={e => atualizarCampo(i, 'cofragem', 'comprimento', e.target.value)} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
            <button onClick={() => setLinhasCofragem([...linhasCofragem, {peca:'', largura:'', altura:'', comprimento:''}])} className="btn-add">+ Linha</button>
          </div>

          <div className="acoes">
            <button onClick={alternarGravacao} className={`icon ${gravando ? 'active' : 'icon-fill'}`}>
              <i><FaMicrophone /></i>
            </button>
            <label className="icon icon-enter">
              <i><FaCamera /></i>
              <input type="file" accept="image/*" capture="environment" onChange={handleFoto} hidden />
            </label>
            <label className="icon icon-expand">
              <i><FaPaperclip /></i>
              <input type="file" accept="image/*" multiple onChange={handleFoto} hidden />
            </label>
          </div>

          <button onClick={finalizarEGerarPDF} className="btn-finalizar" disabled={status.includes("Gerando")}>
            <FaRegFilePdf /> {status.includes("Gerando") ? "Gerando..." : "Finalizar e Gerar PDF"}
          </button>
          
          <button onClick={() => { setLogado(false); localStorage.clear(); }} className="btn-sair">Sair</button>

          <div className="galeria">
            {fotos.map((f, i) => <img key={i} src={f} className="foto-preview" alt="obra" />)}
          </div>
        </div>
      </main>
    </div>
  );
}

export default App;
