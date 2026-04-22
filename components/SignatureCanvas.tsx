"use client";

import { useRef, useState } from "react";
import ReactSignatureCanvas from "react-signature-canvas";

interface Props {
  onSign: (base64: string) => void;
  onClear: () => void;
  disabled?: boolean;
}

export function SignatureCanvas({ onSign, onClear, disabled }: Props) {
  const padRef = useRef<ReactSignatureCanvas>(null);
  const [signed, setSigned] = useState(false);

  const handleEnd = () => {
    const isEmpty = padRef.current?.isEmpty() ?? true;
    setSigned(!isEmpty);
    if (!isEmpty) {
      const base64 = padRef.current!.toDataURL("image/png");
      onSign(base64);
    }
  };

  const handleClear = () => {
    padRef.current?.clear();
    setSigned(false);
    onClear();
  };

  return (
    <div className="space-y-2">
      <div
        className={`border-2 border-dashed rounded-lg bg-white ${
          disabled ? "opacity-60 pointer-events-none" : "border-gray-300"
        }`}
      >
        <ReactSignatureCanvas
          ref={padRef}
          canvasProps={{
            className: "w-full h-48 cursor-crosshair touch-none",
            style: { display: "block", width: "100%", height: "12rem" },
          }}
          onEnd={handleEnd}
          penColor="black"
          throttle={16}
        />
        <p className="text-xs text-center text-gray-400 pb-2">
          {signed ? "✓ Signed — draw again to revise" : "Sign above with mouse or touch"}
        </p>
      </div>
      <button
        type="button"
        onClick={handleClear}
        disabled={disabled}
        className="text-sm text-gray-500 underline disabled:opacity-50"
      >
        Clear signature
      </button>
    </div>
  );
}
