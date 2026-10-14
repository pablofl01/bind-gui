$TTL 3600	; 1 hour
zone1.example.com.	IN SOA	ns1.zone1.example.com. admin.example.com. (
				2026101407 ; serial
				3600       ; refresh (1 hour)
				900        ; retry (15 minutes)
				604800     ; expire (1 week)
				300        ; minimum (5 minutes)
				)
    IN NS  ns1.zone2.example.com.
ns1 IN A   127.0.0.1
