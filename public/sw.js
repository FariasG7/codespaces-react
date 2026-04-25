// CORRETO (dentro de src/App.jsx)
import { jsPDF } from "jspdf"; 

// ... restante do componente ...
const CACHE_NAME='obravoz-v3';
const finalizarEGerarPDF = () => {
  if (!texto && fotos.length === 0) {
    alert("O diário está vazio!");
    return;
  }

  const doc = new jsPDF();
  const larguraPagina = doc.internal.pageSize.getWidth();
  
  // Cabeçalho estilizado (Seu código está ótimo aqui)
  doc.setFillColor(0, 122, 255); 
  doc.rect(0, 0, larguraPagina, 40, 'F');
  
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(22);
  doc.text("DIÁRIO DE OBRA", 15, 25);
  
  // ... continue com o restante da sua lógica de PDF que você postou ...
  doc.save(`Diario_Obra_${new Date().toISOString().split('T')[0]}.pdf`);
  setStatus("PDF gerado com sucesso!");
};
