/**
 * Purchase price reveals margins, so only SUPER_ADMIN may receive it.
 */
function hidePurchasePrice(req, row) {
  if (req.user.role === 'SUPER_ADMIN') return row;
  const { purchase_price, ...rest } = row;
  return rest;
}

module.exports = { hidePurchasePrice };
