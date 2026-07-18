import React, { useState, useRef } from 'react';
import { ChevronLeft, ChevronRight, Maximize2, Minimize2 } from 'lucide-react';
import Image from 'next/image';

const BLOCKED_IMAGE_URL_HINTS = [
  'watermark',
  'wm_',
  'logo-overlay',
  'copyright',
  'nijahomzs-logo',
  'naijahomzs-logo',
  'logo.png'
];

const SOURCE_WATERMARK_HOSTS = [
  'images.nigeriapropertycentre.com',
  'nigeriapropertycentre.com',
  'jiji.ng',
  'jijistatic.com',
  'locanto.com.ng',
  'locanto.ng'
];

const SOURCE_WATERMARK_STYLE = {
  positionClass: 'left-1/2 top-[calc(52%-7px)] -translate-x-1/2 -translate-y-1/2',
  sizeClass: 'w-[25%] min-w-[100px] max-w-[220px] px-[3px] py-0',
  fullscreenSizeClass: 'w-[25%] min-w-[155px] max-w-[360px] px-[3px] py-0',
  containerStyle: {
    background:
      [
        'radial-gradient(ellipse at 46% 52%, rgba(255,255,255,0.035) 0%, rgba(255,255,255,0.022) 44%, rgba(255,255,255,0.006) 76%, rgba(255,255,255,0) 100%)',
        'radial-gradient(circle at 18% 35%, rgba(255,255,255,0.018) 0%, rgba(255,255,255,0.008) 34%, rgba(255,255,255,0) 62%)',
        'radial-gradient(circle at 84% 70%, rgba(255,255,255,0.016) 0%, rgba(255,255,255,0.007) 36%, rgba(255,255,255,0) 64%)'
      ].join(', '),
    WebkitBackdropFilter: 'blur(8px) saturate(112%)',
    backdropFilter: 'blur(8px) saturate(112%)'
  },
  logoStyle: {
    opacity: 0.42,
    filter: 'drop-shadow(0 2px 7px rgba(0, 0, 0, 0.16))'
  }
};

export function shouldCoverSourceWatermark(value, force = false) {
  if (force) return true;

  try {
    const parsed = new URL(String(value || ''));
    const host = parsed.hostname.toLowerCase();
    return SOURCE_WATERMARK_HOSTS.some(
      (sourceHost) => host === sourceHost || host.endsWith(`.${sourceHost}`)
    );
  } catch {
    return false;
  }
}

export function SourceWatermarkCover({ imageUrl, force = false, fullscreen = false }) {
  if (!shouldCoverSourceWatermark(imageUrl, force)) return null;

  return (
    <div
      className={`pointer-events-none absolute z-20 overflow-visible rounded-none ${
        SOURCE_WATERMARK_STYLE.positionClass
      } ${
        fullscreen
          ? SOURCE_WATERMARK_STYLE.fullscreenSizeClass
          : SOURCE_WATERMARK_STYLE.sizeClass
      }`}
      style={SOURCE_WATERMARK_STYLE.containerStyle}
      aria-hidden="true"
    >
      <Image
        src="/nijahomzs-logo.png"
        alt=""
        width={249}
        height={74}
        className="h-auto w-full object-contain"
        style={SOURCE_WATERMARK_STYLE.logoStyle}
        priority={false}
      />
    </div>
  );
}

function isBlockedImageUrl(value) {
  const raw = String(value || '').trim();
  if (!raw) return true;

  const lowerRaw = raw.toLowerCase();
  return BLOCKED_IMAGE_URL_HINTS.some((hint) => lowerRaw.includes(hint));
}

export const ImageGallery = ({ images, coverSourceWatermark = false }) => {
  const [selectedImage, setSelectedImage] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const thumbnailContainerRef = useRef(null);
  const safeImages = Array.isArray(images)
    ? images.filter((img) => Boolean(img) && !isBlockedImageUrl(img))
    : [];
  const uniqueImages = [...new Set(safeImages)];

  const handlePrevImage = () => {
    setSelectedImage((prev) => 
      prev === 0 ? uniqueImages.length - 1 : prev - 1
    );
  };

  const handleNextImage = () => {
    setSelectedImage((prev) => 
      prev === uniqueImages.length - 1 ? 0 : prev + 1
    );
  };

  const scrollThumbnails = (direction) => {
    if (thumbnailContainerRef.current) {
      const scrollAmount = direction * (thumbnailContainerRef.current.offsetWidth / 2);
      thumbnailContainerRef.current.scrollBy({
        left: scrollAmount,
        behavior: 'smooth'
      });
    }
  };

  if (uniqueImages.length === 0) {
    return (
      <div className="w-full max-w-full">
        <div className="relative w-full aspect-[4/3] bg-gray-100 rounded-lg overflow-hidden mx-auto flex items-center justify-center">
          <span className="text-gray-400">No image available</span>
        </div>
      </div>
    );
  }

  if (isFullscreen) {
    return (
      <div className="fixed inset-0 bg-black z-50 flex items-center justify-center">
        <button
          onClick={() => setIsFullscreen(false)}
          className="absolute top-4 right-4 bg-black/50 text-white p-2 rounded-full z-10"
        >
          <Minimize2 size={24} />
        </button>
        
        <button
          onClick={handlePrevImage}
          className="absolute left-4 top-1/2 -translate-y-1/2 bg-black/50 text-white p-2 rounded-full z-10"
        >
          <ChevronLeft size={24} />
        </button>

        <div className="relative h-screen w-screen">
          <Image
            src={uniqueImages[selectedImage]}
            alt="Full screen view"
            fill
            sizes="100vw"
            className="object-contain"
            loading="eager"
          />
          <SourceWatermarkCover
            imageUrl={uniqueImages[selectedImage]}
            force={coverSourceWatermark}
            fullscreen
          />
        </div>

        <button
          onClick={handleNextImage}
          className="absolute right-4 top-1/2 -translate-y-1/2 bg-black/50 text-white p-2 rounded-full z-10"
        >
          <ChevronRight size={24} />
        </button>
      </div>
    );
  }

  return (
    <div className="w-full max-w-full">
      {/* Main Image */}
      <div className="relative w-full aspect-[4/3] bg-gray-100 rounded-lg overflow-hidden mx-auto">
        <Image
          src={uniqueImages[selectedImage]}
          alt={`Property view ${selectedImage + 1}`}
          fill
          sizes="(max-width: 768px) 100vw, 67vw"
          className="object-cover"
          loading={selectedImage === 0 ? 'eager' : 'lazy'}
        />
        <SourceWatermarkCover
          imageUrl={uniqueImages[selectedImage]}
          force={coverSourceWatermark}
        />
        
        <div className="absolute inset-0 flex items-center justify-between px-2">
          <button
            onClick={handlePrevImage}
            className="bg-black/50 text-white p-1.5 rounded-full hover:bg-black/70"
          >
            <ChevronLeft size={16} />
          </button>
          <button
            onClick={handleNextImage}
            className="bg-black/50 text-white p-1.5 rounded-full hover:bg-black/70"
          >
            <ChevronRight size={16} />
          </button>
        </div>

        <button
          onClick={() => setIsFullscreen(true)}
          className="absolute top-2 right-2 bg-black/50 text-white p-1.5 rounded-full hover:bg-black/70"
        >
          <Maximize2 size={16} />
        </button>

        <div className="absolute bottom-2 right-2 bg-black/50 text-white px-2 py-0.5 rounded-full text-xs">
          {selectedImage + 1} / {uniqueImages.length}
        </div>
      </div>

      {/* Thumbnails Slider */}
      <div className="relative mt-2 w-full mx-auto">
        {/* Left Scroll Button */}
        <button
          onClick={() => scrollThumbnails(-1)}
          className="absolute left-0 top-1/2 -translate-y-1/2 z-10 bg-black/50 text-white p-1.5 rounded-full hover:bg-black/70"
          aria-label="Scroll thumbnails left"
        >
          <ChevronLeft size={16} />
        </button>

        {/* Thumbnails Container */}
        <div 
          ref={thumbnailContainerRef}
          className="flex gap-2 overflow-x-auto px-8 py-2 scrollbar-hide scroll-smooth"
        >
          {uniqueImages.map((image, index) => (
            <button
              key={index}
              onClick={() => setSelectedImage(index)}
              className={`relative flex-shrink-0 w-14 h-14 rounded-md overflow-hidden border transition-all
                ${selectedImage === index
                  ? 'ring-2 ring-blue-500 border-blue-500 opacity-100 scale-105'
                  : 'ring-1 ring-gray-200 border-transparent opacity-55 hover:opacity-85'}`}
            >
              <Image
                src={image}
                alt={`Thumbnail ${index + 1}`}
                fill
                sizes="56px"
                loading={index === 0 || index === selectedImage ? 'eager' : 'lazy'}
                className={`object-cover transition-opacity ${
                  selectedImage === index ? 'opacity-100' : 'opacity-80'
                }`}
              />
            </button>
          ))}
        </div>

        {/* Right Scroll Button */}
        <button
          onClick={() => scrollThumbnails(1)}
          className="absolute right-0 top-1/2 -translate-y-1/2 z-10 bg-black/50 text-white p-1.5 rounded-full hover:bg-black/70"
          aria-label="Scroll thumbnails right"
        >
          <ChevronRight size={16} />
        </button>
      </div>

      <style jsx>{`
        .scrollbar-hide {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
        .scrollbar-hide::-webkit-scrollbar {
          display: none;
        }
      `}</style>
    </div>
  );
};
