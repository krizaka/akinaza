-- Several people can work at a shop (krizaka/akinaza#143): the owner is the first one created, whatever the names sort like.
ALTER TABLE "staff" ADD COLUMN "created_at" timestamp with time zone DEFAULT now() NOT NULL;
