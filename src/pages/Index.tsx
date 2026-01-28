const Index = () => {
  return (
    <div className="h-screen w-full flex flex-col">
      {/* Header */}
      <div className="bg-[#1e3a5f] text-white p-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-lg font-semibold">DSG Transport Portal Preview</h1>
        </div>
        <a 
          href="https://portal.dsgtransport.net" 
          target="_blank" 
          rel="noopener noreferrer"
          className="bg-white/20 hover:bg-white/30 px-4 py-1.5 rounded text-sm transition-colors"
        >
          Open in New Tab ↗
        </a>
      </div>
      
      {/* Iframe */}
      <iframe
        src="https://portal.dsgtransport.net"
        className="flex-1 w-full border-0"
        title="DSG Transport Portal"
        allow="clipboard-write"
      />
    </div>
  );
};

export default Index;
