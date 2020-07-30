---
title: NAT traversal
---

[//]: # (Asterisk doc: https://wiki.asterisk.org/wiki/display/AST/Configuring+res_pjsip+to+work+through+NAT)

## What is NAT?

NAT (Network Address Translation) allows multiple devices to share the same
public IP address. This is a very common setup, since there are not enough IPv4
for all devices in the world. When NAT is used, there are two networks involved:
the private network (one private address for each device) and the public network
(one public address shared for all devices).

## Phones are behind a NAT device

In this scenario, we consider that:

* the Wazo Platform has a public IP address
* the phones using the Wazo Platform are behind a NAT device, sharing a common
  IP address.

### The problem

A call is established between the phone and the Wazo Platform, but the phone
can't hear any voice coming in.

Explanation: Since the phones are in a private network, they only know their
private address and port, not their public address and port. SIP phones will
send their private address and port in the SIP messages, and the Wazo Platform
will send the voice packets to the private IP address and port of the phone.
However, the private address and port of the phone is not reachable from the
Wazo Platform: they are only valid in the private network of the phone.


### Solutions

* Wazo Platform should already handle this situation correctly by default.

* You may need to add the following option in the `global` SIP template or
  directly on a line / trunk:

  * `rtp_symmetric` = `yes`

  This setting instructs Wazo Platform (via Asterisk) to send the voice packets
  back to the address and port it came from, i.e. the public address and port of
  the phone.

* Also make sure that the `global` SIP template has no option `force_rport`. The
  default value for this option is `yes`, which is the desired value for NAT
  setups.

## NAT and WebRTC

The WebRTC protocols already handle the NAT scenarios. However, they may need
external services to work in all situations:

* STUN: To get external addresses from a third party
* TURN: To relay the audio/video streams when direct connection is impossible
