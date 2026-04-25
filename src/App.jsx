import { jsPDF } from "jspdf";
import React, { useState, useEffect, useRef, useCallback } from 'react';
import './App.css';
import{FaMicrophone, FaCamera,FaPaperclip}from'react-icons/fa';

function App() {
  const [texto, setTexto] = useState(() => localStorage.getItem('diario_texto') || '');
  const [gravando, setGravando] = useState(false);
  const [clima, setClima] = useState('Buscando localização...');
// Estados para as tabelas
const [linhasCofragem, setLinhasCofragem] = useState([{ peca: '', largura: '', altura: '', comprimento: '' }]);
const [linhasBetao, setLinhasBetao] = useState([{ elemento: '', largura: '', altura: '', comprimento: '' }]);

  const [fotos, setFotos] = useState(() => {
    const saved = localStorage.getItem('diario_fotos');
    return saved ? JSON.parse(saved) : [];
  });
  const [status, setStatus] = useState('Aguardando...');
  
  const recognitionRef = useRef(null);
  const wakeLockRef = useRef(null);

  // --- BUSCA DE CLIMA ---
  const buscarClima = useCallback(async () => {
    if (!navigator.geolocation) return setClima("GPS não suportado");

    navigator.geolocation.getCurrentPosition(async (pos) => {
      const { latitude, longitude } = pos.coords;
      const API_KEY = "5d69641538ee4295a9ffc578b22ad484"; 
      try {
        const res = await fetch(
          `https://api.openweathermap.org/data/2.5/weather?lat=${latitude}&lon=${longitude}&appid=${API_KEY}&units=metric&lang=pt_br`
        );
        if (!res.ok) throw new Error();
        const data = await res.json();
        const iconesClima = {
         Clear: "☀️",
         Clouds: "☁️",
         Rain: "🌧️",
         Thunderstorm: "⛈️",
         Snow: "❄️",
         Drizzle: "🌦️",
         Mist: "🌫️",
         Default: "🌡️" // Caso não encontre correspondência
        };

      const condicao = data.weather[0].main; // Ex: "Clear", "Clouds", etc.
      const icone = iconesClima[condicao] || iconesClima.Default;

      setClima(`${icone} ${Math.round(data.main.temp)}°C | ${data.weather[0].description}`);
      } catch {
        setClima("Clima indisponível");
      }
    }, () => setClima("GPS desligado"));
  }, []);

  // --- CONFIGURAÇÃO DO RECOGNITION ---
  useEffect(() => {
    const Speech = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (Speech) {
      const recognition = new Speech();
      recognition.lang = 'pt-BR';
      recognition.continuous = true;
      recognition.interimResults = false;

      recognition.onresult = (event) => {
        const transcript = event.results[event.results.length - 1][0].transcript;
        setTexto((prev) => prev + (prev.length > 0 ? ' ' : '') + transcript);
      };

      recognition.onend = () => setGravando(false); // Garante que o estado resete se o browser parar

      recognition.onerror = (event) => {
        setStatus(`Erro: ${event.error}`);
        setGravando(false);
      };

      recognitionRef.current = recognition;
    }
    buscarClima();
  }, [buscarClima]);

  // --- PERSISTÊNCIA ---
  useEffect(() => {
    localStorage.setItem('diario_texto', texto);
  }, [texto]);

  useEffect(() => {
    // Alerta: localStorage é limitado para fotos. Ideal usar IndexedDB futuramente.
    try {
      localStorage.setItem('diario_fotos', JSON.stringify(fotos));
    } catch (e) {
      setStatus("Erro: Memória cheia para fotos!");
    }
  }, [fotos]);

  // --- AÇÕES ---
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
    reader.onloadend = () => {
      // Dica: Aqui você poderia implementar um resize com Canvas antes de salvar
      setFotos((prev) => [...prev, reader.result]);
    };
    reader.readAsDataURL(arquivo);
  };


  const finalizarEGerarPDF = () => {
    // Verificação básica
    if (!texto && fotos.length === 0) {
        setStatus("⚠️ Adicione um relato ou foto primeiro.");
        return;
    }

    try {
        const doc = new jsPDF();
        
        // Design do PDF
        doc.setFont("helvetica", "bold");
        doc.text("RELATÓRIO DIÁRIO DE OBRA", 105, 20, { align: "center" });
        
        doc.setFontSize(10);
        doc.setFont("helvetica", "normal");
      const climaTextoLimpo = clima.replace(/[^\x00-\x7F]/g,"").replace("  ", "  ").trim();
        doc.text(`Data: ${new Date().toLocaleDateString('pt-BR')}`, 170, 35,{aling:"right"});
        doc.text(`Clima: ${clima}`, 20, 42);
        
        doc.line(20, 45, 190, 45); // Linha divisória

        // Relato
        doc.setFontSize(12);
        doc.text("Relato da Execução:", 20, 55);
        const splitTexto = doc.splitTextToSize(texto, 170);
        doc.text(splitTexto, 20, 65);

      // Dentro do try do finalizarEGerarPDF, após o relato:

doc.setFont("helvetica", "bold");
doc.text("Medições e Quantidades:", 20, doc.lastAutoTable ? doc.lastAutoTable.finalY + 10 : 100);

// Cálculo Cofragem (Exemplo: 2 * (L+C) * A)
let totalCofragem = 0;
linhasCofragem.forEach((l, i) => {
    const m2 = (Number(l.largura) || 0) * (Number(l.altura) || 0) * (Number(l.comprimento) || 0); // Ajuste a fórmula conforme sua necessidade
    totalCofragem += m2;
});

// Cálculo Betão (L * A * C)
let totalBetao = 0;
linhasBetao.forEach(l => {
    totalBetao += (Number(l.largura) || 0) * (Number(l.altura) || 0) * (Number(l.comprimento) || 0);
});

doc.setFontSize(11);
doc.text(`Total Cofragem: ${totalCofragem.toFixed(2)} m2`, 20, 110);
doc.text(`Total Betão: ${totalBetao.toFixed(2)} m3`, 20, 118);


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


        // Fotos
      doc.line(20, 45, 190, 45); // Linha divisória
        if (fotos.length > 0) {
            doc.addPage();
            
            doc.text("Anexos:", 20, 20);
            fotos.forEach((foto, index) => {
                const yPos = 30 + (index * 70);
                if (yPos < 250) {
                    doc.addImage(foto, 'JPEG', 20, yPos, 80, 60);
                }
            });
        }

        doc.save(`diario_${new Date().getTime()}.pdf`);
        setStatus("✅ PDF Gerado com sucesso!");
      
         // Usamos um pequeno atraso (timeout) ou confirmação para não resetar na cara do usuário
        setTimeout(() => {
            if (window.confirm("Deseja limpar os campos para iniciar um novo relatório?")) {
                setTexto("");          // Limpa o texto do relato
                setFotos([]);          // Esvazia o array de fotos
                setClima("Ensolarado"); // Reseta para o valor padrão (se houver)
                setStatus("📝 Campos prontos para novo relato.");
                
                // Se houver inputs de arquivo (input type="file"), reseta manualmente:
                const inputFoto = document.getElementById('input-foto');
                if (inputFoto) inputFoto.value = "";
            }
        }, 500);
      
      } catch (error) {
        console.error(error);
        setStatus("❌ Erro ao gerar PDF. Verifique a biblioteca jspdf.");
    }
  }


  return (
    <div className="container">
      <header className="header">
        <h1>🏗️ ObraVoz</h1>
        <div className="clima-badge">{clima}</div>
      </header>

      <main className="content">
        <div className="card">
          <textarea value={texto} onChange={(e) => setTexto(e.target.value)} placeholder="Relato de execução..." className="textarea"/>

        <div className="acoes" style={{ display: 'flex', justifyContent: 'center', gap: '20px', padding: '20px' }}>

<div className="card-tabelas" style={{ marginTop: '20px', color: '#fff' }}>
  <h3>📐 Medições de Cofragem (m²)</h3>
  <table style={{ width: '100%', marginBottom: '10px' }}>
    <thead>
      <tr><th>Peça</th><th>L</th><th>A</th><th>C</th></tr>
    </thead>
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

  <h3 style={{ marginTop: '20px' }}>🧊 Cubicagem de Betão (m³)</h3>
  <table style={{ width: '100%' }}>
    <thead>
      <tr><th>Elemento</th><th>L</th><th>A</th><th>C</th></tr>
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

          
  {/* Botão de Voz */}
  <button onClick={alternarGravacao} className={`icon icon-fill ${gravando ? 'active' : ''}`}>
    <i>{gravando ? <FaMicrophone style={{color: 'red'}} /> : <FaMicrophone />}</i>
  </button>

  {/* Botão de Foto */}
  <label className="icon icon-enter">
    <i><FaCamera /></i>
    <input type="file" accept="image/*" capture="environment" onChange={handleFoto} hidden />
  </label>

  {/* Botão Anexar */}
  <input type="file" accept="image/*" multiple onChange={handleFoto} id="upload-button" hidden />
  <label htmlFor="upload-button" className="icon icon-expand">
    <i><FaPaperclip /></i>
  </label>

</div>

        <div className="acoes-finalizacao">
          <button onClick={finalizarEGerarPDF} className="btn-finalizar">
            📂 Gerar PDF
          </button>
        </div>


          <p className="status-label">{status}</p>

          <div className="galeria">
            {fotos.map((foto, i) => (
              <img key={i} src={foto} className="foto-preview" alt="Obra" />
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}
export default App;
