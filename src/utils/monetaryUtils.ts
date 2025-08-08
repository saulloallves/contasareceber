/**
 * Utility functions for handling responsive monetary display
 */

/**
 * Determines the appropriate CSS class for monetary value based on its length
 * @param value - The monetary value as a number
 * @param formatted - The formatted monetary string
 * @returns CSS class name for responsive sizing
 */
export function getMonetaryValueClass(value: number, formatted: string): string {
  const baseClass = 'monetary-value monetary-value-animated';
  
  // Check the length of the formatted string
  if (formatted.length > 15) {
    return `${baseClass} monetary-value-xl`;
  } else if (formatted.length > 12) {
    return `${baseClass} monetary-value-large`;
  }
  
  return baseClass;
}

/**
 * Formats monetary value with responsive considerations
 * @param value - The monetary value as a number
 * @param options - Formatting options
 * @returns Object with formatted value and CSS class
 */
export function formatMonetaryResponsive(
  value: number,
  options: {
    currency?: string;
    locale?: string;
    minimumFractionDigits?: number;
    maximumFractionDigits?: number;
    compact?: boolean;
  } = {}
): { formatted: string; className: string; shouldTruncate: boolean } {
  const {
    currency = 'BRL',
    locale = 'pt-BR',
    minimumFractionDigits = 2,
    maximumFractionDigits = 2,
    compact = false
  } = options;

  let formatted: string;
  
  if (compact && Math.abs(value) >= 1000000) {
    // For very large values, use compact notation
    formatted = new Intl.NumberFormat(locale, {
      style: 'currency',
      currency,
      notation: 'compact',
      maximumFractionDigits: 1
    }).format(value);
  } else {
    formatted = new Intl.NumberFormat(locale, {
      style: 'currency',
      currency,
      minimumFractionDigits,
      maximumFractionDigits
    }).format(value);
  }

  const className = getMonetaryValueClass(value, formatted);
  const shouldTruncate = formatted.length > 20;

  return {
    formatted,
    className,
    shouldTruncate
  };
}

/**
 * Calculates optimal font size based on container width and text length
 * @param containerWidth - Width of the container in pixels
 * @param textLength - Length of the text string
 * @param maxFontSize - Maximum font size in pixels
 * @param minFontSize - Minimum font size in pixels
 * @returns Optimal font size in pixels
 */
export function calculateOptimalFontSize(
  containerWidth: number,
  textLength: number,
  maxFontSize: number = 30,
  minFontSize: number = 12
): number {
  // Estimate character width (approximately 0.6 of font size)
  const estimatedCharWidth = 0.6;
  
  // Calculate required font size to fit text
  const requiredFontSize = (containerWidth * 0.9) / (textLength * estimatedCharWidth);
  
  // Clamp between min and max values
  return Math.max(minFontSize, Math.min(maxFontSize, requiredFontSize));
}

/**
 * Hook for dynamic font sizing based on container dimensions
 * @param ref - React ref to the container element
 * @param text - The text to be displayed
 * @param options - Sizing options
 * @returns Object with dynamic styles
 */
export function useDynamicFontSize(
  ref: React.RefObject<HTMLElement>,
  text: string,
  options: {
    maxFontSize?: number;
    minFontSize?: number;
    padding?: number;
  } = {}
) {
  const { maxFontSize = 30, minFontSize = 12, padding = 16 } = options;
  
  const [fontSize, setFontSize] = React.useState(maxFontSize);
  
  React.useEffect(() => {
    if (!ref.current || !text) return;
    
    const updateFontSize = () => {
      const container = ref.current;
      if (!container) return;
      
      const containerWidth = container.offsetWidth - (padding * 2);
      const optimalSize = calculateOptimalFontSize(
        containerWidth,
        text.length,
        maxFontSize,
        minFontSize
      );
      
      setFontSize(optimalSize);
    };
    
    // Initial calculation
    updateFontSize();
    
    // Update on resize
    const resizeObserver = new ResizeObserver(updateFontSize);
    resizeObserver.observe(ref.current);
    
    return () => {
      resizeObserver.disconnect();
    };
  }, [text, maxFontSize, minFontSize, padding]);
  
  return {
    fontSize: `${fontSize}px`,
    lineHeight: '1.1',
    fontWeight: '700'
  };
}

// Re-export React for the hook
import React from 'react';