const validMonth = (value, latest) =>
  /^\d{4}-(0[1-9]|1[0-2])$/.test(value || "") &&
  value >= "2000-01" &&
  value <= latest;

export function initialSelection(search, latest) {
  const params = new URLSearchParams(search);
  const from = validMonth(params.get("from"), latest)
    ? params.get("from")
    : "2000-01";
  const requestedTo = validMonth(params.get("to"), latest)
    ? params.get("to")
    : latest;
  const to = requestedTo < from ? from : requestedTo;
  const requestedMonth = params.get("month");
  const month =
    validMonth(requestedMonth, latest) &&
    requestedMonth >= from &&
    requestedMonth <= to
      ? requestedMonth
      : to;
  return { range: { from, to }, month, explicitRange: params.has("to") };
}
