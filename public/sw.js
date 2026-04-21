import { jsPDF } from "jspdf";

// Mude de 'v1' para 'v2'
const CACHE_NAME = 'obravoz-v2'; 

const assets = [
  './',
  './index.html',
  './manifest.json'
];

self.addEventListener('install', (event) => {
  // Força o novo Service Worker a assumir o controle imediatamente
  self.skipWaiting(); 
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(assets);
    })
  );
});

self.addEventListener('fetch', (event) => {
  event.respondWith(
    fetch(event.request).catch(() => caches.match(event.request))
  );
});


// ... dentro do seu componente App ...

const finalizarEGerarPDF = () => {
  if (!texto && fotos.length === 0) {
    alert("O diário está vazio!");
    return;
  }

  const doc = new jsPDF();
  const larguraPagina = doc.internal.pageSize.getWidth();
  
  // Cabeçalho estilizado
  doc.setFillColor(0, 122, 255); // Azul padrão do seu app
  doc.rect(0, 0, larguraPagina, 40, 'F');
  
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(22);
  doc.text("DIÁRIO DE OBRA", 15, 25);
  
  doc.setFontSize(10);
  doc.text(`Data: ${new Date().toLocaleDateString('pt-BR')}`, 15, 33);

  // Corpo do Relato
  doc.setTextColor(40, 40, 40);
  doc.setFontSize(14);
  doc.text("Relato da Execução:", 15, 55);
  
  doc.setFontSize(11);
  const textoQuebrado = doc.splitTextToSize(texto, larguraPagina - 30);
  doc.text(textoQuebrado, 15, 65);

  // Adicionar Fotos (2 por página para ficar organizado)
  if (fotos.length > 0) {
    let yImagem = 100; // Posição inicial das fotos
    
    fotos.forEach((foto, index) => {
      // Se a imagem for ultrapassar o fim da página, cria uma nova
      if (yImagem > 240) {
        doc.addPage();
        yImagem = 20;
      }

      try {
        doc.addImage(foto, 'JPEG', 15, yImagem, 80, 60);
        doc.setFontSize(8);
        doc.text(`Registro fotográfico #${index + 1}`, 15, yImagem + 65);
        
        // Alterna entre coluna esquerda e direita ou pula linha
        if (index % 2 === 0) {
          // Próxima foto ao lado (se couber) ou abaixo
          yImagem += 80; 
        }
      } catch (e) {
        console.error("Erro ao incluir imagem no PDF", e);
      }
    });
  }

  // Rodapé
  const totalPaginas = doc.internal.getNumberOfPages();
  for (let i = 1; i <= totalPaginas; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(150);
    doc.text(`Gerado via ObraVoz - Página ${i} de ${totalPaginas}`, larguraPagina / 2, 285, { align: 'center' });
  }

  doc.save(`Diario_Obra_${new Date().toISOString().split('T')[0]}.pdf`);
  setStatus("PDF gerado com sucesso!");
};
