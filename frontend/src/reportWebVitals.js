// This file is used to measure performance metrics in a React application. 
// It imports the necessary functions from the 'web-vitals' library and defines a function `reportWebVitals` 
// that takes a callback function `onPerfEntry`. If the callback is provided and is a function, it dynamically 
// imports the web-vitals functions and calls them with the provided callback to report various performance metrics 
// like CLS, FID, FCP, LCP, and TTFB. Finally, it exports the `reportWebVitals` function as the default export of the module.
const reportWebVitals = onPerfEntry => {
  if (onPerfEntry && onPerfEntry instanceof Function) {
    import('web-vitals').then(({ getCLS, getFID, getFCP, getLCP, getTTFB }) => {
      getCLS(onPerfEntry);
      getFID(onPerfEntry);
      getFCP(onPerfEntry);
      getLCP(onPerfEntry);
      getTTFB(onPerfEntry);
    });
  }
};

export default reportWebVitals;
