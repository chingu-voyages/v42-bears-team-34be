import calculatePaymentSize from "./calculate-payment-size"

describe('calculate payment size tests', ()=> {
  test('returns correct object structure', ()=> {
      const values = calculatePaymentSize(1000);
      expect(Object.keys(values).length).toBe(11);
      expect(Object.keys(values)).toEqual(['2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12'])
  })
  test('returns empty object', ()=> {
    const values = calculatePaymentSize(undefined);
    expect(values).toEqual({})
  })
})