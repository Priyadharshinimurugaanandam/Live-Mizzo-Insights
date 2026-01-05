// src/components/Image.tsx
import React from 'react';
import { getSurgeonImage, getInstrumentImage } from '../utils/imagePath';

type Props = {
  type: 'surgeon' | 'instrument';
  name: string;
  className?: string;
  alt?: string;
};

const Image: React.FC<Props> = ({ type, name, className, alt }) => {
  const src = type === 'surgeon' ? getSurgeonImage(name) : getInstrumentImage(name);

  return (
    <img
      src={src}
      alt={alt || name}
      className={className}
      onError={(e) => {
        e.currentTarget.src = 'public/instruments/monopolar_cautery_hook.png';
      }}
    />
  );
};

export default Image;