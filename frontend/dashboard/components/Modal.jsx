import { useEffect, useRef } from "react";

export default function Modal({ open, onClose, children }) {
  const ref = useRef(null);
  
  useEffect(() => {
    if (!open) return;
    const onKey = e => e.key === "Escape" && onClose?.();
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    ref.current?.focus();
    return () => { 
      document.removeEventListener("keydown", onKey); 
      document.body.style.overflow = ""; 
    };
  }, [open, onClose]);
  
  if (!open) return null;

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center" 
      onClick={onClose} 
      role="dialog" 
      aria-modal="true"
    >
      <div className="absolute inset-0 bg-white/25 dark:bg-black/70 backdrop-blur-sm transition-colors" />
      <div 
        ref={ref} 
        tabIndex={-1} 
        onClick={(e)=>e.stopPropagation()}
        className="relative w-[92%] max-w-3xl bg-white dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-2xl shadow-2xl dark:shadow-[0_25px_70px_-35px_rgba(0,0,0,0.9)] p-6 transition-colors duration-300"
      >
        <button 
          onClick={onClose} 
          className="absolute top-3 right-3 w-8 h-8 grid place-items-center rounded-full text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-900 transition-colors"
        >
          ✕
        </button>
        {children}
      </div>
    </div>
  );
}

