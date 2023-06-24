function calculatePaymentSize(presentValue) {
  if (!presentValue) return {};
  // This will return an object { numberOfPayments: paymentSize$ }
  // 10% per year
  const annualInterest = 0.1; // Store this in an env?

  // in some places you'll see annualInterest/12, annualInterest ^ (1/12) is also acceptable
  const interest = (1 + annualInterest) ** (1 / 12) - 1;

  const paymentsObject = {};
  for (let i = 2; i <= 12; i+= 1) {
    const paymentSize =
      (presentValue * ((1 + interest) ** i * interest)) /
      ((1 + interest) ** i - 1);
    // round it off
    paymentsObject[i] = parseFloat(paymentSize.toFixed(2));
  }
  return paymentsObject;
}
export default calculatePaymentSize;