$TTL 3600
@   IN SOA ns1.zone2.example.com. admin.example.com. (
        2026101401 ; serial
        3600       ; refresh
        900        ; retry
        604800     ; expire
        300 )      ; negative TTL
    IN NS  ns1.zone2.example.com.
ns1 IN A   127.0.0.1
