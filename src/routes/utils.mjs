import { getTicket, deleteUserAndSessions } from '../qlik-utils.mjs';

export async function redirectToQlik(userdir, user, attributes, { targetId, proxyRestUri }, res) {
    if(!targetId || !proxyRestUri)
      return res.sendStatus(400);

    const ticketData = await getTicket(proxyRestUri, userdir, user, attributes, targetId);

    if(!ticketData 
    || !ticketData.Ticket
    || !ticketData.TargetUri)
      return res.sendStatus(401);

    const { Ticket, TargetUri } = ticketData;

    // Redirection
    let redirectURI = TargetUri.indexOf("?") > 0 
      ? `${TargetUri}&qlikTicket=${Ticket}`
      : `${TargetUri}?qlikTicket=${Ticket}`

    res.redirect(redirectURI);
}

export function userFromRequest(req) {
  const { displayName, id, provider, photos } = req.user;
  return {
    UserDirectory: provider,
    UserId: `${displayName}; id=${id}`,
    Attributes: [
      { photo: (photos && photos.length > 0) ? photos[0].value : null },
      { userName: displayName }
    ]
  }
}

export async function webLoginSuccessHandler(req,  res) {
  const { UserDirectory, UserId, Attributes } = userFromRequest(req);
  if(!UserId) return res.sendStatus(401);
  
  // delete all user sessions
  await deleteUserAndSessions(process.env.QLIK_PROXY_SERVICE, UserDirectory, UserId);
  // Get ticket
  const ticketData = await getTicket(process.env.QLIK_PROXY_SERVICE, UserDirectory, UserId, Attributes);

  if(!ticketData 
  || !ticketData.Ticket)
    return res.sendStatus(401);

  // store userid in session
  req.session.user_id = `${UserDirectory.toLowerCase()};${UserId.toLowerCase()}`;

  const { Ticket } = ticketData;

  const redirect = req.session.redirect;
  let redirectURI = redirect.indexOf("?") > 0 
      ? `${redirect}&qlikTicket=${Ticket}`
      : `${redirect}?qlikTicket=${Ticket}`;

  return res
    .redirect(redirectURI);  
}